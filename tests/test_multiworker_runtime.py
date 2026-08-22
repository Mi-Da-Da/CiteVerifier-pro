import sqlite3
import tempfile
import unittest
from contextlib import closing
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from runtime_store import RuntimeStore


DEFAULTS = {"status": "idle", "processed": 0}


class MultiWorkerRuntimeTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.temp_dir.name) / "runtime.sqlite"

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_progress_written_by_one_store_is_visible_to_another(self):
        worker_one = RuntimeStore(self.db_path)
        worker_two = RuntimeStore(self.db_path)
        worker_one.set_task_progress(7, "task-a", DEFAULTS, {"processed": 12})
        self.assertEqual(worker_two.get_task_progress(7, "task-a", DEFAULTS)["processed"], 12)

    def test_concurrent_writers_do_not_lock_database(self):
        stores = [RuntimeStore(self.db_path) for _ in range(4)]

        def write(index):
            return stores[index % len(stores)].set_task_progress(
                7, f"task-{index}", DEFAULTS, {"processed": index}
            )

        with ThreadPoolExecutor(max_workers=8) as executor:
            results = list(executor.map(write, range(40)))
        self.assertEqual(len(results), 40)

    def test_runtime_database_uses_wal(self):
        RuntimeStore(self.db_path)
        with closing(sqlite3.connect(self.db_path)) as connection:
            mode = connection.execute("PRAGMA journal_mode").fetchone()[0]
        self.assertEqual(mode.lower(), "wal")


if __name__ == "__main__":
    unittest.main()
