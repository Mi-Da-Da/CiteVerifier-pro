import json
import tempfile
import threading
import time
import unittest
from pathlib import Path
from unittest.mock import patch

from checker.clients import baidu_selenium


class FakeDriver:
    def __init__(self):
        self.current_url = "https://xueshu.baidu.com/"
        self.quit_calls = 0

    def quit(self):
        self.quit_calls += 1


class ChromeDriverLifecycleTests(unittest.TestCase):
    def setUp(self):
        baidu_selenium.reset_browser_shutdown()

    def tearDown(self):
        baidu_selenium.reset_browser_shutdown()

    def test_leftover_lock_file_does_not_block_new_owner(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            lock_path = Path(temp_dir) / ".install.lock"
            lock_path.write_bytes(b"0")
            started = time.monotonic()
            with baidu_selenium._driver_install_lock(str(lock_path), timeout=0.5):
                pass
            self.assertLess(time.monotonic() - started, 0.5)

    def test_disk_cache_requires_matching_chrome_build(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            cache_dir = root / ".webdriver"
            cache_dir.mkdir()
            driver = root / "chromedriver.exe"
            driver.write_bytes(b"")
            (cache_dir / "driver_cache.json").write_text(
                json.dumps({
                    "chromedriver": {
                        "cached": {
                            "version": "151.0.7922.138",
                            "path": str(driver),
                        }
                    }
                }),
                encoding="utf-8",
            )
            with patch.object(
                baidu_selenium,
                "_installed_chrome_version",
                return_value="151.0.7922.140",
            ):
                self.assertEqual(
                    baidu_selenium._cached_chromedriver_path(str(root)),
                    str(driver.resolve()),
                )
            with patch.object(
                baidu_selenium,
                "_installed_chrome_version",
                return_value="151.0.8000.1",
            ):
                self.assertIsNone(
                    baidu_selenium._cached_chromedriver_path(str(root))
                )

    def test_shutdown_interrupts_active_search_and_closes_all_drivers(self):
        created = []

        def factory(_headless, _path):
            driver = FakeDriver()
            created.append(driver)
            return driver

        def blocking_search(_args):
            baidu_selenium._SHUTDOWN_EVENT.wait(30)
            return []

        pool = baidu_selenium.ChromeDriverPool(
            size=2,
            headless=True,
            driver_path="fake-driver",
            driver_factory=factory,
        )
        result = []
        with patch.object(baidu_selenium, "search_batch_in_browser", blocking_search):
            search_thread = threading.Thread(
                target=lambda: result.extend(pool.search(["a", "b"])),
                daemon=True,
            )
            search_thread.start()
            deadline = time.monotonic() + 2
            while len(created) < 2 and time.monotonic() < deadline:
                time.sleep(0.01)

            started = time.monotonic()
            pool.shutdown(timeout=2)
            search_thread.join(2)

        self.assertFalse(search_thread.is_alive())
        self.assertLess(time.monotonic() - started, 2)
        self.assertEqual([driver.quit_calls for driver in created], [1, 1])
        self.assertEqual(result, [])


if __name__ == "__main__":
    unittest.main()
