"""Observability 전용 stub. summary(LLM) 기능 비활성 — API 키 불필요.

send_event.py 가 top-level 에서 generate_event_summary 를 import 하므로 이름만 제공한다.
--summarize 플래그를 쓰지 않는 한 호출되지 않는다.
"""


def generate_event_summary(event_data):
    return None
