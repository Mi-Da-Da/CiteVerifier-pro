from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.keys import Keys
import time
import pandas as pd
from rapidfuzz import fuzz
from concurrent.futures import ThreadPoolExecutor
from queue import Queue
from webdrivermanager_cn import ChromeDriverManagerAliMirror
import os
import socket
import threading
import json
import re
from contextlib import contextmanager

_SHUTDOWN_EVENT = threading.Event()


def request_browser_shutdown():
    """通知所有百度检索线程尽快停止当前批次。"""
    _SHUTDOWN_EVENT.set()


def reset_browser_shutdown():
    """应用启动时重置退出标记。"""
    _SHUTDOWN_EVENT.clear()

def _get_free_port():
    """向操作系统申请一个当前空闲的 TCP 端口，避免端口越界或多进程并发冲突。"""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('127.0.0.1', 0))
        return s.getsockname()[1]


def create_driver(headless=False, driver_path=None):
    """创建浏览器实例"""
    chrome_options = Options()
    chrome_options.add_argument('--no-sandbox')
    chrome_options.add_argument('--disable-dev-shm-usage')
    chrome_options.add_argument('--disable-gpu')
    chrome_options.add_argument('--disable-images')
    debug_port = _get_free_port()
    chrome_options.add_argument(f'--remote-debugging-port={debug_port}')

    if headless:
        chrome_options.add_argument('--headless=new')

    if not driver_path:
        raise RuntimeError("ChromeDriver 路径为空")

    service = Service(driver_path)
    driver = webdriver.Chrome(service=service, options=chrome_options)

    driver.set_page_load_timeout(20)
    driver.set_script_timeout(20)

    return driver


def get_url_with_retry(driver, url, max_retries=3, retry_delay=2):
    """带重试机制的页面加载"""
    for attempt in range(max_retries):
        try:
            driver.get(url)
            WebDriverWait(driver, 15).until(
                lambda d: d.execute_script("return document.readyState") == "complete"
            )
            if "百度学术" in driver.title or "xueshu" in driver.current_url:
                return True
        except:
            if attempt < max_retries - 1:
                time.sleep(retry_delay)
    return False


def get_result_titles(driver):
    """获取搜索结果中的所有标题和作者（获取全部，不限制数量）。
    返回 (results, page_ok)：page_ok=False 表示页面本身异常（验证码/跳出搜索域名/无法读取DOM），
    此时 results 为空不代表真的"未找到"，调用方应区别处理。
    """
    results = []
    page_ok = True
    try:
        current_url = driver.current_url
        if "xueshu.baidu.com" not in current_url:
            return results, False
        page_text = driver.find_element(By.TAG_NAME, "body").text
        if "验证码" in page_text or "安全验证" in page_text:
            return results, False

        items = driver.find_elements(By.CSS_SELECTOR, "[data-v-ee77df1d]")

        for item in items:
            try:
                title = item.find_element(By.CSS_SELECTOR, "h3.c-font.paper-title").text.strip()
                author = item.find_element(By.CSS_SELECTOR, "div.paper-info > span > a > span").text.strip()

                if title:
                    results.append({'title': title, 'author': author})
            except:
                continue

    except Exception as e:
        page_ok = False

    return results, page_ok


def find_best_match(search_title, titles):
    """找到最相似的标题"""
    best_match = None
    best_score = 0

    for title in titles:
        score = fuzz.WRatio(search_title.lower(), title.lower()) / 100.0

        if search_title.lower() in title.lower():
            score += 0.2
        elif title.lower() in search_title.lower():
            score += 0.1

        if score > best_score:
            best_score = score
            best_match = title

    return best_match, min(best_score, 1.0)


def search_batch_in_browser(args):
    """
    单个浏览器连续搜索多个标题
    """
    titles_list, headless, exact_match, similarity_threshold, browser_id, driver_path, *provided = args

    driver = provided[0] if provided else None
    owns_driver = driver is None
    results = []

    print(f"[浏览器 {browser_id}] 启动，准备搜索 {len(titles_list)} 个标题")

    try:
        if owns_driver:
            driver = create_driver(headless, driver_path)

        # 首次加载首页
        if not get_url_with_retry(driver, "https://xueshu.baidu.com/", max_retries=3):
            print(f"[浏览器 {browser_id}] ❌ 无法加载百度学术首页")
            for title in titles_list:
                results.append({
                    '搜索标题': title,
                    '是否存在': False,
                    '匹配标题': None,
                    '置信度': 0,
                    '作者': None,
                    '来源': None,
                    '错误信息': '首页加载失败',
                    '耗时': 0,
                    '浏览器ID': browser_id
                })
            return results

        print(f"[浏览器 {browser_id}] ✅ 首页加载成功")

        for i, title in enumerate(titles_list, 1):
            if _SHUTDOWN_EVENT.is_set():
                print(f"[浏览器 {browser_id}] 收到退出信号，停止剩余检索")
                break
            result = {
                '搜索标题': title,
                '是否存在': False,
                '匹配标题': None,
                '置信度': 0,
                '作者': None,
                '来源': None,
                '错误信息': None,
                '耗时': 0,
                '浏览器ID': browser_id
            }

            try:
                start_time = time.time()

                if i == 1:
                    # 第一次搜索：使用 textarea
                    try:
                        wait = WebDriverWait(driver, 10)
                        textarea = wait.until(
                            EC.presence_of_element_located((By.CLASS_NAME, "atomic-textarea-box"))
                        )
                        textarea.clear()
                        textarea.send_keys(title)
                        if _SHUTDOWN_EVENT.wait(0.5):
                            break

                        button = driver.find_element(By.CSS_SELECTOR, "div.send-btn")
                        driver.execute_script("arguments[0].click();", button)
                    except Exception as e:
                        result['错误信息'] = f'首次搜索失败: {str(e)[:50]}'
                        results.append(result)
                        print(f"[浏览器 {browser_id}] [{i}/{len(titles_list)}] ⚠ {title[:30]}... -> 首次搜索失败: {str(e)[:50]}")
                        continue
                else:
                    # 后续搜索：使用顶部的 input 输入框
                    try:
                        wait = WebDriverWait(driver, 10)
                        search_input = wait.until(
                            EC.presence_of_element_located((By.CSS_SELECTOR, "input.atomic-input.search-input"))
                        )
                        search_input.clear()
                        search_input.send_keys(title)
                        if _SHUTDOWN_EVENT.wait(0.5):
                            break
                        search_input.send_keys(Keys.RETURN)
                    except Exception as e:
                        # 顶部输入框定位失败：很可能页面已脱离正常搜索状态，重新加载首页后用 textarea 方式重试一次
                        recovered = get_url_with_retry(driver, "https://xueshu.baidu.com/", max_retries=2)
                        retried = False
                        if recovered:
                            try:
                                retry_textarea = WebDriverWait(driver, 10).until(
                                    EC.presence_of_element_located((By.CLASS_NAME, "atomic-textarea-box"))
                                )
                                retry_textarea.clear()
                                retry_textarea.send_keys(title)
                                time.sleep(0.5)
                                retry_button = driver.find_element(By.CSS_SELECTOR, "div.send-btn")
                                driver.execute_script("arguments[0].click();", retry_button)
                                retried = True
                            except Exception:
                                retried = False
                        if not retried:
                            result['错误信息'] = f'输入框定位失败: {str(e)[:50]}'
                            results.append(result)
                            print(f"[浏览器 {browser_id}] [{i}/{len(titles_list)}] ⚠ {title[:30]}... -> 输入框定位失败: {str(e)[:50]}")
                            continue

                # 等待结果加载
                if _SHUTDOWN_EVENT.wait(2):
                    break

                # 获取所有搜索结果
                search_results, page_ok = get_result_titles(driver)
                titles_found = [r['title'] for r in search_results]

                if not page_ok:
                    # 页面异常（验证码/跳出搜索域名/DOM读取失败）：重新加载首页后重试一次，而不是直接判"未找到"
                    recovered = get_url_with_retry(driver, "https://xueshu.baidu.com/", max_retries=2)
                    if recovered:
                        try:
                            retry_input = WebDriverWait(driver, 10).until(
                                EC.presence_of_element_located((By.CLASS_NAME, "atomic-textarea-box"))
                            )
                            retry_input.clear()
                            retry_input.send_keys(title)
                            time.sleep(0.5)
                            retry_button = driver.find_element(By.CSS_SELECTOR, "div.send-btn")
                            driver.execute_script("arguments[0].click();", retry_button)
                            if _SHUTDOWN_EVENT.wait(2):
                                break
                            search_results, page_ok = get_result_titles(driver)
                            titles_found = [r['title'] for r in search_results]
                        except Exception:
                            page_ok = False

                if not page_ok:
                    result['错误信息'] = '页面异常（验证码或访问受限），结果不可信'
                    results.append(result)
                    print(f"[浏览器 {browser_id}] [{i}/{len(titles_list)}] ⚠ {title[:30]}... -> 页面异常")
                    continue

                if not titles_found:
                    result['错误信息'] = '未找到搜索结果'
                    results.append(result)
                    print(f"[浏览器 {browser_id}] [{i}/{len(titles_list)}] ✗ {title[:30]}... -> 未找到")
                    continue

                # 匹配标题
                if exact_match:
                    if title in titles_found:
                        result['是否存在'] = True
                        result['匹配标题'] = title
                        result['置信度'] = 1.0
                        for r in search_results:
                            if r['title'] == title:
                                result['作者'] = r['author']
                                break
                else:
                    best_match, best_score = find_best_match(title, titles_found)
                    if best_score >= similarity_threshold:
                        result['是否存在'] = True
                        result['匹配标题'] = best_match
                        result['置信度'] = best_score
                        for r in search_results:
                            if r['title'] == best_match:
                                result['作者'] = r['author']
                                break

                result['耗时'] = round(time.time() - start_time, 2)
                results.append(result)

                status = "✓" if result['是否存在'] else "✗"
                print(f"[浏览器 {browser_id}] [{i}/{len(titles_list)}] {status} {title[:30]}... ({result['耗时']}s)")

                # 搜索间隔
                if i < len(titles_list):
                    if _SHUTDOWN_EVENT.wait(1):
                        break

            except Exception as e:
                result['错误信息'] = f'搜索出错: {str(e)[:100]}'
                results.append(result)
                print(f"[浏览器 {browser_id}] [{i}/{len(titles_list)}] ✗ {title[:30]}... 出错")

        print(f"[浏览器 {browser_id}] 完成，共搜索 {len(titles_list)} 个标题")
        return results

    except Exception as e:
        print(f"[浏览器 {browser_id}] ❌ 程序出错: {e}")
        return []
    finally:
        if owns_driver and driver:
            driver.quit()
            print(f"[浏览器 {browser_id}] 浏览器已关闭")


def split_list_into_chunks(data_list, num_chunks):
    """将列表分割成多个子列表"""
    chunk_size = (len(data_list) + num_chunks - 1) // num_chunks
    return [data_list[i:i + chunk_size] for i in range(0, len(data_list), chunk_size)]


_DRIVER_PATH_CACHE: str | None = None
_DRIVER_PATH_LOCK = threading.Lock()


def _installed_chrome_version() -> str | None:
    """读取本机 Chrome 完整版本；无法可靠识别时返回 None。"""
    if os.name != "nt":
        return None
    try:
        import winreg
        locations = (
            (winreg.HKEY_CURRENT_USER, r"Software\Google\Chrome\BLBeacon"),
            (winreg.HKEY_LOCAL_MACHINE, r"Software\Google\Chrome\BLBeacon"),
            (winreg.HKEY_LOCAL_MACHINE, r"Software\WOW6432Node\Google\Chrome\BLBeacon"),
        )
        for hive, key_path in locations:
            try:
                with winreg.OpenKey(hive, key_path) as key:
                    version, _ = winreg.QueryValueEx(key, "version")
                match = re.match(r"\d+(?:\.\d+){2,3}", str(version))
                if match:
                    return match.group(0)
            except OSError:
                continue
    except (ImportError, ValueError):
        pass
    return None


def _cached_chromedriver_path(driver_dir: str) -> str | None:
    """从 webdrivermanager_cn 的磁盘缓存中复用与当前 Chrome 匹配的驱动。"""
    chrome_version = _installed_chrome_version()
    if chrome_version is None:
        return None
    chrome_build = ".".join(chrome_version.split(".")[:3])
    cache_path = os.path.join(driver_dir, ".webdriver", "driver_cache.json")
    try:
        with open(cache_path, "r", encoding="utf-8") as cache_file:
            cache = json.load(cache_file)
    except (OSError, ValueError, TypeError):
        return None

    entries = cache.get("chromedriver", {}) if isinstance(cache, dict) else {}
    if not isinstance(entries, dict):
        return None
    for entry in entries.values():
        if not isinstance(entry, dict):
            continue
        version = str(entry.get("version", ""))
        path = entry.get("path")
        driver_build = ".".join(version.split(".")[:3])
        if driver_build == chrome_build and isinstance(path, str) and os.path.isfile(path):
            return os.path.abspath(path)
    return None


@contextmanager
def _driver_install_lock(lock_path: str, timeout: float = 120.0):
    """跨进程操作系统文件锁；进程异常退出时由系统自动释放。"""
    lock_file = open(lock_path, "a+b")
    lock_file.seek(0, os.SEEK_END)
    if lock_file.tell() == 0:
        lock_file.write(b"0")
        lock_file.flush()

    deadline = time.monotonic() + timeout
    locked = False
    try:
        while not locked:
            lock_file.seek(0)
            try:
                if os.name == "nt":
                    import msvcrt
                    msvcrt.locking(lock_file.fileno(), msvcrt.LK_NBLCK, 1)
                else:
                    import fcntl
                    fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
                locked = True
            except (OSError, BlockingIOError):
                if time.monotonic() >= deadline:
                    raise TimeoutError("Timed out waiting for ChromeDriver installation lock")
                time.sleep(0.2)
        yield
    finally:
        if locked:
            lock_file.seek(0)
            if os.name == "nt":
                import msvcrt
                msvcrt.locking(lock_file.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                import fcntl
                fcntl.flock(lock_file.fileno(), fcntl.LOCK_UN)
        lock_file.close()


def ensure_chromedriver(driver_path: str | None = None) -> str:
    """
    返回已安装好的 chromedriver 可执行文件绝对路径。

    首次调用会从阿里源下载匹配当前 Chrome 版本的驱动到项目根目录下的
    chromedriver 子目录；后续调用直接复用进程级缓存，避免重复下载。
    可显式传入 driver_path 跳过下载（供外部预安装使用）。
    """
    global _DRIVER_PATH_CACHE
    if _DRIVER_PATH_CACHE:
        return _DRIVER_PATH_CACHE
    with _DRIVER_PATH_LOCK:
        if _DRIVER_PATH_CACHE:
            return _DRIVER_PATH_CACHE
        if driver_path:
            _DRIVER_PATH_CACHE = driver_path
            return driver_path
        print("正在检测 Chrome 版本并准备对应驱动...")
        # 安装到项目根目录下的 chromedriver 子目录，基于 __file__ 解析避免受 cwd 影响
        project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        driver_dir = os.path.join(project_root, "chromedriver")
        os.makedirs(driver_dir, exist_ok=True)
        cached_path = _cached_chromedriver_path(driver_dir)
        if cached_path:
            print(f"复用已缓存的 ChromeDriver: {cached_path}")
            _DRIVER_PATH_CACHE = cached_path
            return cached_path

        install_lock = os.path.join(driver_dir, ".install.lock")
        with _driver_install_lock(install_lock):
            # 另一个 Uvicorn worker 可能刚刚完成安装，拿到锁后必须再次检查磁盘缓存。
            path = _cached_chromedriver_path(driver_dir)
            if not path:
                path = ChromeDriverManagerAliMirror(path=driver_dir).install()
        print(f"ChromeDriver 已准备完成: {path}")
        _DRIVER_PATH_CACHE = path
        return path


def _env_flag(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


class ChromeDriverPool:
    """A small, process-local pool; one driver is never shared concurrently."""

    def __init__(self, size=None, headless=None, driver_path=None, driver_factory=None):
        configured = size if size is not None else os.getenv("BAIDU_BROWSER_POOL_SIZE", "2")
        self.size = max(1, int(configured))
        self.headless = _env_flag("BAIDU_HEADLESS", True) if headless is None else headless
        self.driver_path = driver_path
        self.driver_factory = driver_factory or create_driver
        self._drivers = Queue(maxsize=self.size)
        self._initialized = False
        self._init_lock = threading.Lock()
        self._drivers_lock = threading.Lock()
        self._all_drivers = []
        self._closing = False

    def _new_driver(self):
        if _SHUTDOWN_EVENT.is_set():
            raise RuntimeError("Browser pool is shutting down")
        path = ensure_chromedriver(self.driver_path)
        driver = self.driver_factory(self.headless, path)
        if _SHUTDOWN_EVENT.is_set():
            try:
                driver.quit()
            except Exception:
                pass
            raise RuntimeError("Browser pool is shutting down")
        with self._drivers_lock:
            self._all_drivers.append(driver)
        return driver

    def _ensure_initialized(self):
        if self._initialized:
            return
        with self._init_lock:
            if self._initialized:
                return
            created = []
            try:
                for _ in range(self.size):
                    created.append(self._new_driver())
                for driver in created:
                    self._drivers.put(driver)
                self._initialized = True
            except Exception:
                for driver in created:
                    try:
                        driver.quit()
                    except Exception:
                        pass
                raise

    def _return_driver(self, driver):
        if self._closing or _SHUTDOWN_EVENT.is_set():
            return
        try:
            _ = driver.current_url
        except Exception:
            try:
                driver.quit()
            except Exception:
                pass
            driver = self._new_driver()
        self._drivers.put(driver)

    def search(self, titles_list, exact_match=False, similarity_threshold=0.7):
        if not titles_list:
            return []
        self._ensure_initialized()
        worker_count = min(self.size, len(titles_list))
        chunks = split_list_into_chunks(titles_list, worker_count)

        def run_chunk(item):
            browser_id, chunk = item
            driver = self._drivers.get()
            try:
                return search_batch_in_browser((
                    chunk, self.headless, exact_match, similarity_threshold,
                    browser_id, self.driver_path, driver,
                ))
            finally:
                self._return_driver(driver)

        executor = ThreadPoolExecutor(max_workers=worker_count)
        try:
            nested = list(executor.map(run_chunk, enumerate(chunks, 1)))
        finally:
            try:
                executor.shutdown(wait=False, cancel_futures=True)
            except TypeError:  # Python 3.8 compatibility
                executor.shutdown(wait=False)
        return [result for group in nested for result in group]

    def shutdown(self, timeout=5.0):
        self._closing = True
        request_browser_shutdown()
        init_lock_acquired = self._init_lock.acquire(timeout=min(0.5, timeout))
        try:
            with self._drivers_lock:
                drivers = list(self._all_drivers)
                self._all_drivers.clear()

            def quit_driver(driver):
                try:
                    driver.quit()
                except Exception:
                    pass

            quit_threads = []
            for driver in drivers:
                thread = threading.Thread(target=quit_driver, args=(driver,), daemon=True)
                thread.start()
                quit_threads.append(thread)

            deadline = time.monotonic() + timeout
            for thread in quit_threads:
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    break
                thread.join(remaining)

            while not self._drivers.empty():
                try:
                    self._drivers.get_nowait()
                except Exception:
                    break
            self._initialized = False
        finally:
            if init_lock_acquired:
                self._init_lock.release()


_BROWSER_POOL = None
_BROWSER_POOL_LOCK = threading.Lock()


def get_browser_pool(headless=None, max_workers=None, driver_path=None):
    global _BROWSER_POOL
    with _BROWSER_POOL_LOCK:
        if _BROWSER_POOL is None:
            _BROWSER_POOL = ChromeDriverPool(max_workers, headless, driver_path)
        return _BROWSER_POOL


def shutdown_browser_pool():
    global _BROWSER_POOL
    with _BROWSER_POOL_LOCK:
        if _BROWSER_POOL is not None:
            _BROWSER_POOL.shutdown()
            _BROWSER_POOL = None


def batch_validate_parallel(titles_list, headless=None, exact_match=False,
                            similarity_threshold=0.7, max_workers=None,
                            driver_path: str | None = None):
    """使用当前 web worker 的常驻 ChromeDriver 池并行验证。"""
    pool = get_browser_pool(headless, max_workers, driver_path)
    actual_workers = min(pool.size, len(titles_list))

    print(f"标题总数: {len(titles_list)}")
    print(f"启动 {actual_workers} 个浏览器并行搜索...")
    chunks = split_list_into_chunks(titles_list, actual_workers) if titles_list else []
    print(f"分配方案: {[len(chunk) for chunk in chunks]}")
    print("=" * 60)

    start_time = time.time()

    combined_results = pool.search(titles_list, exact_match, similarity_threshold)

    # 按原始顺序排序
    order_map = {title: idx for idx, title in enumerate(titles_list)}
    combined_results.sort(key=lambda x: order_map.get(x['搜索标题'], 999))

    df = pd.DataFrame(combined_results)

    total_time = time.time() - start_time

    exist_count = df['是否存在'].sum() if len(df) > 0 else 0

    print(f"\n{'=' * 60}")
    print(f"✅ 验证完成！")
    print(f"📊 总条数: {len(titles_list)}")
    print(f"⏱️  总耗时: {total_time:.2f} 秒")
    print(f"📈 存在: {exist_count} 条")

    return df
