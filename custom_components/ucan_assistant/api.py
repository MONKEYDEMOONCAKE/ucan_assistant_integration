"""API client for Your Server."""

from __future__ import annotations

import json
import hashlib
import asyncio
import logging
from typing import Any, List
from aiohttp import ClientSession, ClientResponseError
import async_timeout
from datetime import datetime, timedelta, timezone

from .const import (
    API_SIGNIN,
    ERROR_CODE_SUCCESS,
    ERROR_CODE_SUCCESS_STR,
    CONF_TOKEN,
    CONF_ROLE,
    API_DEVICE_CONFIG,
    API_DEVICE_STATUS,
    API_DEVICE_LIST,
    API_DEVICE_INFO,
    API_DEVICE_DETAILS,
    API_DEVICE_ALARMS,
)

_LOGGER = logging.getLogger(__name__)


class AuthenticationError(Exception):
    """认证错误."""


class ServerDataError(Exception):
    """服务器数据错误."""


class UcanServerApiClient:
    """Your Server API客户端."""

    def __init__(
        self, session: ClientSession, host: str, token: str | None = None
    ) -> None:
        """初始化API客户端."""
        self._session = session
        self._host = host.rstrip("/")  # 移除可能的“/”
        self._token = token

    async def async_signin(self, sign: str, password: str) -> dict[str, Any]:
        """登录并获取token."""
        url = f"{self._host}{API_SIGNIN}"
        _LOGGER.debug("url: %s", url)
        # 对password进行MD5加密
        password_md5 = hashlib.md5(password.encode()).hexdigest()
        payload = {"sign": sign, "password": password_md5}
        _LOGGER.debug("payload: %s", payload)
        _LOGGER.debug("try login: %s", sign)

        try:
            async with async_timeout.timeout(10):
                response = await self._session.post(
                    url, json=payload, headers={"Content-Type": "application/json"}
                )

                if response.status != 200:
                    raise AuthenticationError(f"HTTP err: {response.status}")  # noqa: TRY301

                # 先获取响应文本（不管Content-Type，强制读文本）
                response_text = await response.text()
                result = json.loads(response_text)

                if (
                    result.get("error_code") != ERROR_CODE_SUCCESS_STR
                    and result.get("error_code") != ERROR_CODE_SUCCESS
                ):
                    _LOGGER.error("登录失败: %s", result.get("error_code"))
                    msg = result.get("msg", "unknown err")
                    raise AuthenticationError(f"login failed: {msg}")  # noqa: TRY301

                # 保存token
                self._token = result.get("token")

                _LOGGER.debug("login success, role: %s", result.get("role"))

                return {CONF_TOKEN: self._token, CONF_ROLE: result.get("role")}

        except asyncio.TimeoutError as err:  # noqa: UP041
            _LOGGER.error("登录超时: %s", err)
            raise AuthenticationError("连接超时") from err
        except Exception as err:
            _LOGGER.error("登录异常: %s", err)
            raise AuthenticationError(f"登录异常: {err}") from err

    # 新增：获取设备列表
    async def async_get_device_list(self) -> List[dict[str, Any]]:
        """获取用户名下所有设备列表"""
        if not self._token:
            _LOGGER.error("尝试获取设备列表时未认证")
            raise AuthenticationError("未认证，请先登录")

        url = f"{self._host}{API_DEVICE_LIST}"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self._token}",
        }

        try:
            async with async_timeout.timeout(10):
                response = await self._session.post(url=url, headers=headers)

                if response.status != 200:
                    raise AuthenticationError(f"HTTP err: {response.status}")

                result = json.loads(await response.text())

                if (
                    result.get("error_code") != ERROR_CODE_SUCCESS
                    and result.get("error_code") != ERROR_CODE_SUCCESS_STR
                ):
                    raise ServerDataError(f"获取设备列表失败: {result.get('msg')}")

                return result.get("list", [])
        except asyncio.TimeoutError as err:  # noqa: UP041
            _LOGGER.error("获取设备列表超时: %s", err)
            raise ServerDataError("获取设备列表超时") from err
        except Exception as err:
            _LOGGER.error("获取设备列表异常: %s", err)
            raise ServerDataError(f"获取设备列表异常: {err}") from err

    async def async_get_device_status(self, device_id: str) -> dict[str, Any]:
        """获取设备状态."""
        if not self._token:
            _LOGGER.error("尝试获取设备状态时未认证")
            raise AuthenticationError("未认证，请先登录")

        url = f"{self._host}{API_DEVICE_STATUS}"
        payload = {"device_id": device_id}
        # _LOGGER.debug("payload: %s", payload)
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self._token}",
        }

        try:
            async with async_timeout.timeout(10):
                response = await self._session.post(url, json=payload, headers=headers)

                if response.status != 200:
                    raise AuthenticationError(f"HTTP err: {response.status}")  # noqa: TRY301

                response_text = await response.text()
                result = json.loads(response_text)
                if (
                    result.get("error_code") != ERROR_CODE_SUCCESS_STR
                    and result.get("error_code") != ERROR_CODE_SUCCESS
                ):
                    raise ServerDataError(
                        f"获取设备状态失败: {result.get('msg', 'unknown err')}"
                    )  # noqa: TRY301

                return result.get("data", {})

        except asyncio.TimeoutError as err:  # noqa: UP041
            _LOGGER.error("获取设备状态超时: %s", err)
            raise ServerDataError("获取设备状态超时") from err
        except Exception as err:
            _LOGGER.error("获取设备状态异常: %s", err)
            raise ServerDataError(f"获取设备状态异常: {err}") from err

    async def async_get_device_config(self, device_id: str) -> dict[str, Any]:
        """获取设备配置."""
        if not self._token:
            _LOGGER.error("尝试获取设备配置时未认证")
            raise AuthenticationError("未认证，请先登录")

        url = f"{self._host}{API_DEVICE_CONFIG}"
        payload = {"device_id": device_id}
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self._token}",
        }

        try:
            async with async_timeout.timeout(10):
                response = await self._session.post(url, json=payload, headers=headers)

                if response.status != 200:
                    raise AuthenticationError(f"HTTP err: {response.status}")  # noqa: TRY301

                response_text = await response.text()
                result = json.loads(response_text)
                _LOGGER.debug("result: %s", result)
                if (
                    result.get("error_code") != ERROR_CODE_SUCCESS_STR
                    and result.get("error_code") != ERROR_CODE_SUCCESS
                ):
                    raise ServerDataError(
                        f"获取设备配置失败: {result.get('msg', 'unknown err')}"
                    )  # noqa: TRY301
                data = result.get("data", {})
                return data.get("timezone", 0)

        except asyncio.TimeoutError as err:  # noqa: UP041
            _LOGGER.error("获取设备配置超时: %s", err)
            raise ServerDataError("获取设备配置超时") from err
        except Exception as err:
            _LOGGER.error("获取设备配置异常: %s", err)
            raise ServerDataError(f"获取设备配置异常: {err}") from err

    async def async_get_device_info(self, device_id: str) -> dict[str, Any]:
        """获取设备信息."""
        if not self._token:
            _LOGGER.error("尝试获取设备信息时未认证")
            raise AuthenticationError("未认证，请先登录")

        url = f"{self._host}{API_DEVICE_INFO}"
        payload = {"device_id": device_id}
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self._token}",
        }

        try:
            async with async_timeout.timeout(10):
                response = await self._session.post(url, json=payload, headers=headers)

                if response.status != 200:
                    raise AuthenticationError(f"HTTP err: {response.status}")  # noqa: TRY301

                response_text = await response.text()
                result = json.loads(response_text)
                if (
                    result.get("error_code") != ERROR_CODE_SUCCESS_STR
                    and result.get("error_code") != ERROR_CODE_SUCCESS
                ):
                    raise ServerDataError(
                        f"获取设备信息失败: {result.get('msg', 'unknown err')}"
                    )  # noqa: TRY301

                return result.get("data", {})

        except asyncio.TimeoutError as err:  # noqa: UP041
            _LOGGER.error("获取设备信息超时: %s", err)
            raise ServerDataError("获取设备信息超时") from err
        except Exception as err:
            _LOGGER.error("获取设备信息异常: %s", err)
            raise ServerDataError(f"获取设备信息异常: {err}") from err

    async def async_get_device_details(self, device_id: str) -> dict[str, Any]:
        """获取设备详细信息."""
        if not self._token:
            _LOGGER.error("尝试获取设备详细信息时未认证")
            raise AuthenticationError("未认证，请先登录")

        url = f"{self._host}{API_DEVICE_DETAILS}"
        payload = {"device_id": device_id}
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self._token}",
        }

        try:
            async with async_timeout.timeout(10):
                response = await self._session.post(url, json=payload, headers=headers)

                if response.status != 200:
                    raise AuthenticationError(f"HTTP err: {response.status}")  # noqa: TRY301

                response_text = await response.text()
                result = json.loads(response_text)
                if (
                    result.get("error_code") != ERROR_CODE_SUCCESS_STR
                    and result.get("error_code") != ERROR_CODE_SUCCESS
                ):
                    raise ServerDataError(
                        f"获取设备详细信息失败: {result.get('msg', 'unknown err')}"
                    )  # noqa: TRY301

                return result.get("data", {})

        except asyncio.TimeoutError as err:  # noqa: UP041
            _LOGGER.error("获取设备详细信息超时: %s", err)
            raise ServerDataError("获取设备详细信息超时") from err
        except Exception as err:
            _LOGGER.error("获取设备详细信息异常: %s", err)
            raise ServerDataError(f"获取设备详细信息异常: {err}") from err

    async def async_get_device_alarms(self, device_id: str) -> dict[str, Any]:
        """获取设备告警信息."""
        if not self._token:
            _LOGGER.error("尝试获取设备告警信息时未认证")
            raise AuthenticationError("未认证，请先登录")

        url = f"{self._host}{API_DEVICE_ALARMS}"
        # 获取当前 UTC 时间
        now_utc = datetime.now(timezone.utc)
        # 获取 24 小时前的 UTC 时间
        start_utc = now_utc - timedelta(hours=24)
        payload = {
            "device_id": device_id,
            "start_time": int(start_utc.timestamp()),
            "end_time": int(now_utc.timestamp()),
        }
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self._token}",
        }

        try:
            async with async_timeout.timeout(10):
                response = await self._session.post(url, json=payload, headers=headers)

                if response.status != 200:
                    raise AuthenticationError(f"HTTP err: {response.status}")  # noqa: TRY301

                response_text = await response.text()
                result = json.loads(response_text)
                # _LOGGER.debug("设备告警信息响应JSON解析结果: %s", result)
                if (
                    result.get("error_code") != ERROR_CODE_SUCCESS_STR
                    and result.get("error_code") != ERROR_CODE_SUCCESS
                ):
                    raise ServerDataError(
                        f"获取设备告警信息失败: {result.get('msg', 'unknown err')}"
                    )  # noqa: TRY301

                return result.get("data", {})

        except asyncio.TimeoutError as err:  # noqa: UP041
            _LOGGER.error("获取设备告警信息超时: %s", err)
            raise ServerDataError("获取设备告警信息超时") from err
        except Exception as err:
            _LOGGER.error("获取设备告警信息异常: %s", err)
            raise ServerDataError(f"获取设备告警信息异常: {err}") from err

    @property
    def is_authenticated(self) -> bool:
        """检查是否已认证."""
        return self._token is not None

    @property
    def token(self) -> str | None:
        """获取token."""
        return self._token
