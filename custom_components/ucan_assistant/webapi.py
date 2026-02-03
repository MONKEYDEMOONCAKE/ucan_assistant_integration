"""前端API接口"""

import json
import logging
from aiohttp import web
from homeassistant.components.http import HomeAssistantView
from homeassistant.core import HomeAssistant
from .const import (
    DOMAIN,
    DATA_CACHE,
    CACHE_CURRENT_DEVICE,
    CACHE_DEVICE_LIST,
    CACHE_DEVICE_STATUS,
    CACHE_DEVICE_DETAILS,
    CACHE_DEVICE_INFO,
    CACHE_DEVICE_ALARMS,
    WEB_API_BASE_NAME,
    WEB_API_BASE_URL,
)

_LOGGER = logging.getLogger(__name__)


async def register_views(hass: HomeAssistant) -> None:
    """注册自定义API视图."""
    app = hass.http.app  # 获取aiohttp应用实例
    # 注册设备列表视图
    view = DeviceListView()
    if view.name not in app.router.named_resources():
        app.router.add_get(view.url, view.get, name=view.name)
    # 注册设备状态视图
    view = DeviceStatusView()
    if view.name not in app.router.named_resources():
        app.router.add_get(view.url, view.get, name=view.name)
        app.router.add_post(view.url, view.post, name=view.name)

    # 注册设备信息视图
    view = DeviceInfoView()
    if view.name not in app.router.named_resources():
        app.router.add_get(view.url, view.get, name=view.name)

    # 注册设备详细信息视图
    view = DeviceDetailsView()
    if view.name not in app.router.named_resources():
        app.router.add_get(view.url, view.get, name=view.name)

    # 注册设备告警信息视图
    view = DeviceAlarmsView()
    if view.name not in app.router.named_resources():
        app.router.add_get(view.url, view.get, name=view.name)


class DeviceListView(HomeAssistantView):
    """自定义API视图."""

    url = WEB_API_BASE_URL.rstrip("/") + "/device_list"
    name = WEB_API_BASE_NAME.rstrip(":") + ":device_list"
    requires_auth = True  # 要求HA认证

    async def get(self, request):
        """获取设备列表."""
        hass = request.app["hass"]

        # 检查缓存是否存在
        if DOMAIN not in hass.data:
            return web.json_response(
                {"error": "集成未初始化", "list": [], "success": False}, status=503
            )

        if DATA_CACHE not in hass.data[DOMAIN]:
            return web.json_response(
                {"error": "缓存未初始化", "list": [], "success": False}, status=503
            )

        # 从缓存获取数据
        data = hass.data[DOMAIN][DATA_CACHE].get(CACHE_DEVICE_LIST, {})

        # 返回格式化数据
        return web.json_response({"list": data, "count": len(data), "success": True})


class DeviceStatusView(HomeAssistantView):
    """自定义API视图."""

    url = WEB_API_BASE_URL.rstrip("/") + "/device_status"
    name = WEB_API_BASE_NAME.rstrip(":") + ":device_status"
    requires_auth = True  # 要求HA认证

    async def post(self, request):
        """获取当前设备."""
        hass = request.app["hass"]
        # 解析请求体
        _LOGGER.debug("请求数据: %s", await request.json())
        data = await request.json()
        device_sn = data.get("device_sn")
        device_id = data.get("device_id")
        _LOGGER.debug("设置当前设备: device_sn=%s, device_id=%s", device_sn, device_id)

        if not device_sn or not device_id:
            return web.json_response(
                {"success": False, "message": "device_sn 或 device_id 必须提供"},
                status=400,
            )
        hass.data[DOMAIN][DATA_CACHE][CACHE_CURRENT_DEVICE] = {
            "device_sn": device_sn,
            "device_id": device_id,
        }

        # 清空原先设备缓存
        hass.data[DOMAIN][DATA_CACHE][CACHE_DEVICE_STATUS] = {}
        hass.data[DOMAIN][DATA_CACHE][CACHE_DEVICE_INFO] = {}
        hass.data[DOMAIN][DATA_CACHE][CACHE_DEVICE_DETAILS] = {}
        hass.data[DOMAIN][DATA_CACHE][CACHE_DEVICE_ALARMS] = {}

        return web.json_response(
            {"success": True, "data": {"device_sn": device_sn, "device_id": device_id}}
        )

    async def get(self, request):
        """获取设备状态."""
        hass = request.app["hass"]

        # 检查缓存是否存在
        if DOMAIN not in hass.data:
            return web.json_response(
                {"error": "集成未初始化", "status": [], "success": False}, status=503
            )

        if DATA_CACHE not in hass.data[DOMAIN]:
            return web.json_response(
                {"error": "缓存未初始化", "status": [], "success": False}, status=503
            )

        # 从缓存获取数据
        data = hass.data[DOMAIN][DATA_CACHE].get(CACHE_DEVICE_STATUS, {})

        # 返回格式化数据
        return web.json_response({"status": data, "success": True})


class DeviceInfoView(HomeAssistantView):
    """自定义API视图."""

    url = WEB_API_BASE_URL.rstrip("/") + "/device_info"
    name = WEB_API_BASE_NAME.rstrip(":") + ":device_info"
    requires_auth = True  # 要求HA认证

    async def get(self, request):
        """获取设备信息."""
        hass = request.app["hass"]

        # 检查缓存是否存在
        if DOMAIN not in hass.data:
            return web.json_response(
                {"error": "集成未初始化", "info": {}, "success": False}, status=503
            )

        if DATA_CACHE not in hass.data[DOMAIN]:
            return web.json_response(
                {"error": "缓存未初始化", "info": {}, "success": False}, status=503
            )

        # 从缓存获取数据
        data = hass.data[DOMAIN][DATA_CACHE].get(CACHE_DEVICE_INFO, {})

        # 返回格式化数据
        return web.json_response({"info": data, "success": True})


class DeviceDetailsView(HomeAssistantView):
    """自定义API视图."""

    url = WEB_API_BASE_URL.rstrip("/") + "/device_details"
    name = WEB_API_BASE_NAME.rstrip(":") + ":device_details"
    requires_auth = True  # 要求HA认证

    async def get(self, request):
        """获取设备详细信息."""
        hass = request.app["hass"]

        # 检查缓存是否存在
        if DOMAIN not in hass.data:
            return web.json_response(
                {"error": "集成未初始化", "details": {}, "success": False}, status=503
            )

        if DATA_CACHE not in hass.data[DOMAIN]:
            return web.json_response(
                {"error": "缓存未初始化", "details": {}, "success": False}, status=503
            )

        # 从缓存获取数据
        data = hass.data[DOMAIN][DATA_CACHE].get(CACHE_DEVICE_DETAILS, {})

        # 返回格式化数据
        return web.json_response({"details": data, "success": True})


class DeviceAlarmsView(HomeAssistantView):
    """自定义API视图."""

    url = WEB_API_BASE_URL.rstrip("/") + "/device_alarms"
    name = WEB_API_BASE_NAME.rstrip(":") + ":device_alarms"
    requires_auth = True  # 要求HA认证

    async def get(self, request):
        """获取设备告警信息."""
        hass = request.app["hass"]

        # 检查缓存是否存在
        if DOMAIN not in hass.data:
            return web.json_response(
                {"error": "集成未初始化", "alarms": {}, "success": False}, status=503
            )

        if DATA_CACHE not in hass.data[DOMAIN]:
            return web.json_response(
                {"error": "缓存未初始化", "alarms": {}, "success": False}, status=503
            )

        # 从缓存获取数据
        data = hass.data[DOMAIN][DATA_CACHE].get(CACHE_DEVICE_ALARMS, {})

        # 返回格式化数据
        return web.json_response({"alarms": data, "success": True})


# 注册详情API（需要在__init__.py中补充）
# 在async_setup_entry中添加：
# await hass.http.async_register_view(MyHTTPIntegrationDeviceDetailView)
