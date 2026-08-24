import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

import web_app


class ProgressFlowTests(unittest.TestCase):
    def _run(self, titles, *, scholar=True, google=True, prefix=0):
        updates = []

        def capture_progress(_user_id, _task_id, **kwargs):
            updates.append(kwargs)

        english_results = [
            {
                "query_title": title,
                "found": False,
                "source": "dblp",
            }
            for title in titles
            if not web_app._is_chinese_title(title)
        ]
        baidu_results = [
            {
                "query_title": title,
                "found": False,
                "source": "baidu_scholar",
            }
            for title in titles
            if web_app._is_chinese_title(title)
        ]

        with (
            patch.object(web_app, "_set_progress", side_effect=capture_progress),
            patch.object(web_app, "_resolve_db_path", return_value=Path(__file__)),
            patch.object(web_app, "_parallel_batch_search", return_value=english_results),
            patch.object(web_app.runtime_store, "increment_counter"),
            patch.object(web_app.runtime_store, "start_batch_run", return_value=1),
            patch.object(web_app.runtime_store, "record_batch_item"),
            patch.object(web_app.runtime_store, "finish_batch_run"),
            patch(
                "checker.clients.baidu_client.batch_search_baidu",
                new=AsyncMock(return_value=baidu_results),
            ),
            patch(
                "checker.clients.serpapi_google_scholar_client.is_available",
                return_value=scholar,
            ),
            patch(
                "checker.clients.serpapi_google_scholar_client.batch_search_google_scholar",
                new=AsyncMock(return_value=[]),
            ),
            patch(
                "checker.clients.serpapi_google_search_client.is_available",
                return_value=google,
            ),
            patch(
                "checker.clients.serpapi_google_search_client.batch_search_google_search",
                new=AsyncMock(return_value=[]),
            ),
        ):
            result = web_app._run_batch_search(
                titles,
                max_candidates=10,
                user_id=7,
                task_id="progress-test",
                progress_stage_prefix=prefix,
            )
        return result, updates

    def assert_valid_progress(self, updates):
        percentages = [update["percent"] for update in updates if "percent" in update]
        self.assertEqual(percentages, sorted(percentages))
        self.assertEqual(percentages[-1], 100)
        self.assertNotIn(100, percentages[:-1])
        self.assertEqual(updates[-1]["status"], "done")

    def test_mixed_titles_follow_all_available_sources_in_order(self):
        _, updates = self._run(["中文文献", "English paper"])
        stages = [update["stage"] for update in updates if "stage" in update]
        expected = [
            "Searching Baidu Scholar",
            "Searching DBLP",
            "Searching Google Scholar (DBLP fallback)",
            "Searching Google (final fallback)",
            "Preparing results",
            "Done",
        ]
        positions = [stages.index(stage) for stage in expected]
        self.assertEqual(positions, sorted(positions))
        self.assert_valid_progress(updates)

    def test_chinese_only_does_not_reserve_english_sources(self):
        _, updates = self._run(["中文文献"])
        stages = [update.get("stage") for update in updates]
        self.assertIn("Searching Baidu Scholar", stages)
        self.assertNotIn("Searching DBLP", stages)
        self.assertNotIn("Searching Google Scholar (DBLP fallback)", stages)
        self.assert_valid_progress(updates)

    def test_pdf_prefix_still_finishes_only_at_done(self):
        _, updates = self._run(["English paper"], prefix=1)
        first_percent = next(update["percent"] for update in updates if "percent" in update)
        self.assertGreater(first_percent, 0)
        self.assert_valid_progress(updates)


if __name__ == "__main__":
    unittest.main()
