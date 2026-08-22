import unittest
from unittest.mock import patch

from checker.clients.baidu_selenium import ChromeDriverPool


class FakeDriver:
    def __init__(self):
        self.current_url = "https://xueshu.baidu.com/"
        self.quit_calls = 0

    def quit(self):
        self.quit_calls += 1


class ChromeDriverPoolTests(unittest.TestCase):
    def test_drivers_are_reused_and_closed_only_on_shutdown(self):
        created = []

        def factory(_headless, _path):
            driver = FakeDriver()
            created.append(driver)
            return driver

        def fake_search(args):
            titles, _, _, _, browser_id, _, driver = args
            return [
                {"搜索标题": title, "是否存在": True, "浏览器ID": browser_id,
                 "driver_id": id(driver)}
                for title in titles
            ]

        pool = ChromeDriverPool(
            size=2, headless=True, driver_path="fake-driver", driver_factory=factory
        )
        with patch("checker.clients.baidu_selenium.search_batch_in_browser", fake_search):
            first = pool.search(["a", "b", "c"])
            second = pool.search(["d", "e"])

        self.assertEqual(len(created), 2)
        self.assertTrue({item["driver_id"] for item in first + second}.issubset(
            {id(driver) for driver in created}
        ))
        self.assertEqual([driver.quit_calls for driver in created], [0, 0])
        pool.shutdown()
        self.assertEqual([driver.quit_calls for driver in created], [1, 1])


if __name__ == "__main__":
    unittest.main()
