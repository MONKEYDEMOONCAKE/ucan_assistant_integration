"""The ucan server data integration."""

from __future__ import annotations

import logging
import asyncio
from aiohttp import web
from homeassistant.config_entries import ConfigEntry

from homeassistant.const import Platform
from homeassistant.core import HomeAssistant
from homeassistant.components import panel_custom
from homeassistant.components.frontend import DATA_PANELS
from homeassistant.helpers.aiohttp_client import async_get_clientsession


from .api import UcanServerApiClient, AuthenticationError
from .const import (
    DOMAIN,
    API_BASE_URL,
    CACHE_CURRENT_DEVICE,
    CACHE_DEVICE_LIST,
    CACHE_DEVICE_STATUS,
    CACHE_DEVICE_INFO,
    CACHE_DEVICE_DETAILS,
    CACHE_DEVICE_ALARMS,
    CACHE_DEVICE_POWER_DATA,
    DEFAULT_SCAN_INTERVAL,
    DATA_CACHE,
    DATA_UPDATE_TASK,
)

from .webapi import register_views

# TODO List the platforms that you want to support.
# For your initial PR, limit it to 1 platform.
_PLATFORMS: list[Platform] = [Platform.SENSOR]

# TODO Create ConfigEntry type alias with API object
# TODO Rename type alias and update all entry annotations
# type New_NameConfigEntry = ConfigEntry[MyApi]  # noqa: F821

_LOGGER = logging.getLogger(__name__)


# TODO Update entry annotation
async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up ucan server data from a config entry."""
    # 初始化API客户端（使用配置中的host和登录获取的token）
    session = async_get_clientsession(hass)
    token = entry.data.get("token")
    api = UcanServerApiClient(
        session,
        host=API_BASE_URL,
        token=token,  # 从配置数据中获取token
    )

    hass.data.setdefault(DOMAIN, {})
    # 初始化缓存
    hass.data[DOMAIN][DATA_CACHE] = {}
    # 存储API实例
    hass.data[DOMAIN][entry.entry_id] = {"api": api}

    # 启动传感器平台
    await hass.config_entries.async_forward_entry_setups(entry, _PLATFORMS)

    # 启动定时更新任务
    update_task = asyncio.create_task(async_update_data(hass, entry))
    hass.data[DOMAIN][DATA_UPDATE_TASK] = update_task

    await register_views(hass)

    entry.async_on_unload(entry.add_update_listener(async_update_options))

    # 2. 使用 panel_custom 注册 iframe 面板（推荐方式）
    # 这种方式允许你加载自定义 JS 文件作为面板
    if "ucan-panel" not in hass.data.get(DATA_PANELS, {}):
        await panel_custom.async_register_panel(
            hass,
            webcomponent_name="ucan-assistant-card",
            frontend_url_path="ucan-panel",  # 访问路径 /ucan-panel
            config_panel_domain="ucan_assistant",  # 关联的集成域
            module_url="/local/community/ucan_assistant_card/ucan-assistant-card.js",  # 指向你注册的 JS 文件
            sidebar_title="UCAN",  # 侧边栏标题
            sidebar_icon="mdi:robot",  # 侧边栏图标
            embed_iframe=False,  # 直接嵌入，不使用 iframe
            require_admin=False,
        )

    return True


async def async_update_options(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """更新配置项后重新初始化API并重载."""
    # 重新初始化API客户端
    session = async_get_clientsession(hass)
    api = UcanServerApiClient(
        session,
        host=API_BASE_URL,
        token=entry.data.get("token"),
    )
    hass.data[DOMAIN][entry.entry_id]["api"] = api

    # 重新加载配置项
    await hass.config_entries.async_reload(entry.entry_id)


# TODO Update entry annotation
async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    # 取消更新任务
    if DATA_UPDATE_TASK in hass.data[DOMAIN]:
        update_task = hass.data[DOMAIN][DATA_UPDATE_TASK]
        update_task.cancel()

    # 清理缓存
    if DOMAIN in hass.data:
        hass.data.pop(DOMAIN)

    return await hass.config_entries.async_unload_platforms(entry, _PLATFORMS)


async def async_update_data(hass: HomeAssistant, entry: ConfigEntry):
    """定时拉取服务器数据并更新缓存."""
    api = hass.data[DOMAIN][entry.entry_id]["api"]

    if not hasattr(async_update_data, "list_update_counter"):
        async_update_data.list_update_counter = 0

    while True:
        try:
            async_update_data.list_update_counter += 1
            if async_update_data.list_update_counter % 2 == 0:
                # 更新设备列表
                hass.data[DOMAIN][DATA_CACHE][
                    CACHE_DEVICE_LIST
                ] = await api.async_get_device_list()
                _LOGGER.debug(
                    "设备列表已更新，包含%d个设备",
                    len(hass.data[DOMAIN][DATA_CACHE][CACHE_DEVICE_LIST]),
                )

            current_device = hass.data[DOMAIN][DATA_CACHE].get(CACHE_CURRENT_DEVICE, {})
            device_id = current_device.get("device_id")  # 是否选中设备
            if device_id:
                if (
                    hass.data[DOMAIN][DATA_CACHE][CACHE_DEVICE_STATUS] == {}
                    or async_update_data.list_update_counter % 2 == 0
                ):
                    # 更新设备数据
                    hass.data[DOMAIN][DATA_CACHE][
                        CACHE_DEVICE_STATUS
                    ] = await api.async_get_device_status(device_id)
                    hass.data[DOMAIN][DATA_CACHE][
                        CACHE_DEVICE_INFO
                    ] = await api.async_get_device_info(device_id)
                    result = await api.async_get_device_config(device_id)
                    hass.data[DOMAIN][DATA_CACHE][CACHE_DEVICE_INFO]["timezone"] = (
                        result
                    )
                    hass.data[DOMAIN][DATA_CACHE][
                        CACHE_DEVICE_DETAILS
                    ] = await api.async_get_device_details(device_id)
                    hass.data[DOMAIN][DATA_CACHE][
                        CACHE_DEVICE_ALARMS
                    ] = await api.async_get_device_alarms(device_id)

        except AuthenticationError:
            # 触发重新登录配置流
            hass.async_create_task(
                hass.config_entries.flow.async_init(
                    DOMAIN,
                    context={"source": "reauth", "entry_id": entry.entry_id},
                    data=entry.data,
                )
            )
            _LOGGER.warning("设备获取失败：未认证，已触发重新登录流程")
            return
        except Exception as e:
            _LOGGER.error("设备更新失败: %s", e)

        # 等待指定间隔
        # _LOGGER.debug("cache data: %s", hass.data[DOMAIN][DATA_CACHE])
        await asyncio.sleep(DEFAULT_SCAN_INTERVAL)
