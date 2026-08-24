from unittest.mock import Mock

from checker.clients.baidu_selenium import get_result_titles


def _driver_with_items(items):
    driver = Mock()
    driver.current_url = "https://xueshu.baidu.com/s?wd=test"
    body = Mock()
    body.text = "百度学术搜索结果"
    driver.find_element.return_value = body
    driver.find_elements.return_value = items
    return driver


def test_result_title_is_kept_when_author_is_missing():
    item = Mock()
    title = Mock()
    title.text = "测试文献标题"

    def find_element(_by, selector):
        if selector == "h3.c-font.paper-title":
            return title
        raise LookupError(selector)

    item.find_element.side_effect = find_element
    results, page_ok = get_result_titles(_driver_with_items([item]))

    assert page_ok is True
    assert results == [{"title": "测试文献标题", "author": None}]


def test_result_containers_without_titles_are_page_error():
    item = Mock()
    item.find_element.side_effect = LookupError("title missing")

    results, page_ok = get_result_titles(_driver_with_items([item]))

    assert results == []
    assert page_ok is False
