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
from multiprocessing import Pool, cpu_count
import os

driver_path = r"E:\chromedriver-win64\chromedriver-win64\chromedriver.exe"


def create_driver(headless=False):
    """创建浏览器实例"""
    chrome_options = Options()
    chrome_options.add_argument('--incognito')
    chrome_options.add_argument('--no-sandbox')
    chrome_options.add_argument('--disable-dev-shm-usage')
    chrome_options.add_argument('--disable-gpu')
    chrome_options.add_argument('--disable-images')
    chrome_options.add_argument(f'--remote-debugging-port={os.getpid()}')

    if headless:
        chrome_options.add_argument('--headless=new')

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
    """获取搜索结果中的所有标题和作者（获取全部，不限制数量）"""
    results = []
    try:
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
        pass

    return results


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
    titles_list, headless, exact_match, similarity_threshold, browser_id = args

    driver = None
    results = []

    print(f"[浏览器 {browser_id}] 启动，准备搜索 {len(titles_list)} 个标题")

    try:
        driver = create_driver(headless)

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
                        time.sleep(0.5)

                        button = driver.find_element(By.CSS_SELECTOR, "div.send-btn")
                        driver.execute_script("arguments[0].click();", button)
                    except Exception as e:
                        result['错误信息'] = f'首次搜索失败: {str(e)[:50]}'
                        results.append(result)
                        continue
                else:
                    # 后续搜索：使用顶部的 input 输入框
                    try:
                        search_input = driver.find_element(By.CSS_SELECTOR, "input.atomic-input.search-input")
                        search_input.clear()
                        search_input.send_keys(title)
                        time.sleep(0.5)
                        search_input.send_keys(Keys.RETURN)
                    except Exception as e:
                        result['错误信息'] = f'输入框定位失败: {str(e)[:50]}'
                        results.append(result)
                        continue

                # 等待结果加载
                time.sleep(2)

                # 获取所有搜索结果
                search_results = get_result_titles(driver)
                titles_found = [r['title'] for r in search_results]

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
                    time.sleep(1)

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
        if driver:
            driver.quit()
            print(f"[浏览器 {browser_id}] 浏览器已关闭")


def split_list_into_chunks(data_list, num_chunks):
    """将列表分割成多个子列表"""
    chunk_size = (len(data_list) + num_chunks - 1) // num_chunks
    return [data_list[i:i + chunk_size] for i in range(0, len(data_list), chunk_size)]


def batch_validate_parallel(titles_list, headless=False, exact_match=False,
                            similarity_threshold=0.7, max_workers=3):
    """多浏览器并行批量验证"""
    if max_workers is None:
        max_workers = min(cpu_count(), len(titles_list), 4)

    chunks = split_list_into_chunks(titles_list, max_workers)
    chunks = [chunk for chunk in chunks if chunk]
    actual_workers = len(chunks)

    print(f"标题总数: {len(titles_list)}")
    print(f"启动 {actual_workers} 个浏览器并行搜索...")
    print(f"分配方案: {[len(chunk) for chunk in chunks]}")
    print("=" * 60)

    start_time = time.time()

    args_list = [
        (chunk, headless, exact_match, similarity_threshold, i + 1)
        for i, chunk in enumerate(chunks)
    ]

    with Pool(processes=actual_workers) as pool:
        all_results = pool.map(search_batch_in_browser, args_list)

    # 合并所有结果
    combined_results = []
    for results in all_results:
        combined_results.extend(results)

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


def main():
    titles_to_check = [
        "《联合国国际货物销售合同公约》在中国法院适用问题的研究",
        "《联合国国际货物销售合同公约》在我国的适用路径——以中化新加坡公司诉德国克虏伯公司案为例",
        "国际民商事条约自治解释与国家主义解释的反思与重构",
        "紧急避险限度的利益衡量问题研究",
        "于欢案的刑法分析",
        "女王诉杜德利和斯蒂芬斯案",
        "自然法学:理性主义的历史演进",
        "从专利申请的角度看中医药专利保护困局"
    ]

    try:
        results_df = batch_validate_parallel(
            titles_list=titles_to_check,
            headless=True,
            exact_match=False,
            similarity_threshold=0.7,
            max_workers=4
        )

        if not results_df.empty:
            results_df.to_csv('validation_results.csv', index=False, encoding='utf-8-sig')
            print(f"\n💾 结果已保存到 validation_results.csv")
            print(f"\n📋 详细结果:")
            print(results_df[['搜索标题', '是否存在', '置信度', '作者', '耗时', '浏览器ID']].to_string())

    except Exception as e:
        print(f"❌ 程序出错: {e}")


if __name__ == "__main__":
    main()