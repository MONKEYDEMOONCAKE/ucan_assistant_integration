"""传感器平台实现."""

from __future__ import annotations
import logging
from typing import Any, Dict
from datetime import timedelta
from time import time

from homeassistant.components.sensor import (
    SensorDeviceClass,
    SensorEntity,
    SensorStateClass,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.entity import DeviceInfo
from homeassistant.helpers.update_coordinator import (
    CoordinatorEntity,
    DataUpdateCoordinator,
    UpdateFailed,
)

from .api import UcanServerApiClient, AuthenticationError
from .const import DOMAIN, SENSOR_SCAN_INTERVAL
from .sensor_config import DATA_FIELD_CONFIG


_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """初始化多设备 + 传感器实体."""
    # 获取API客户端实例
    api = hass.data[DOMAIN][entry.entry_id]["api"]

    # 第一步：获取设备列表
    try:
        device_list = await api.async_get_device_list()
    except AuthenticationError:
        # 触发重新登录配置流
        hass.async_create_task(
            hass.config_entries.flow.async_init(
                DOMAIN,
                context={"source": "reauth", "entry_id": entry.entry_id},
                data=entry.data,
            )
        )
        _LOGGER.warning("设备列表获取失败：未认证，已触发重新登录流程")
        return
    except Exception as err:
        _LOGGER.error("获取设备列表失败：%s", err)
        return
    if not device_list:
        _LOGGER.warning("未获取到任何设备")
        return

    # 第二步：为每个设备创建协调器+传感器
    all_entities = []
    for device in device_list:
        device_id = device.get("device_id")
        device_name = device.get("device_sn")
        invmodel = await get_inv_model(device.get("inverter_model"))

        # 跳过无设备ID的无效设备
        if not device_id:
            continue

        # 创建该设备的数椐协调器
        coordinator = DeviceDataCoordinator(
            hass, api, device_id, device_name, entry.entry_id, invmodel
        )
        await coordinator.async_config_entry_first_refresh()

        # 为该设备创建所有传感器（基于DATA_FIELD_CONFIG）
        for field_name, config in DATA_FIELD_CONFIG.items():
            sensor = DeviceSensor(
                coordinator=coordinator,
                field_name=field_name,
                device_class=config[0],
                unit=config[1],
                state_class=config[2],
                value_transform=config[3],
            )
            all_entities.append(sensor)

    # 批量添加所有传感器实体
    async_add_entities(all_entities)


async def get_inv_model(inv_model: str) -> str:
    # 逆变器型号映射
    inverter_models = {
        "tq": "uhc",
        "mr": "uhome",
        "sk": "ufox",
        "uhc-lv": "uhc-lv",
        "uhc-hv": "uhc-hv",
        "uhc-3-lv": "uhc-3-lv",
        "uhc-3-hv": "uhc-3-hv",
        "uhome-lv": "uhome-lv",
        "uhome-hv": "uhome-hv",
        "uhome-3-lv": "uhome-3-lv",
        "uhome-3-hv": "uhome-3-hv",
        "upc": "upc",
        "ufox-x2": "ufox-x2",
        "ufox-x3": "ufox-x3",
        "monet": "monet",
        "eboxmini": "eboxmini",
        "usgr": "upc-hbk",
        "upc-hb": "upc-hb",
        "usj": "uhc-i&c-u2",
        "bdc": "bdc",
    }
    return inverter_models.get(inv_model, inv_model)


# 设备数据协调器（按设备ID区分）
class DeviceDataCoordinator(DataUpdateCoordinator[Dict[str, Any]]):
    """单设备数据协调器（负责轮询单个设备的状态）"""

    def __init__(
        self,
        hass: HomeAssistant,
        api: UcanServerApiClient,
        device_id: str,
        device_name: str,
        entry_id: str,
        invmodel: str,
    ):
        super().__init__(
            hass,
            _LOGGER,
            name=f"Device {device_name} ({device_id})",
            update_interval=timedelta(seconds=SENSOR_SCAN_INTERVAL),
        )
        self.api = api
        self.device_id = device_id
        self.device_name = device_name
        self.entry_id = entry_id
        self.invmodel = invmodel

    async def _async_update_data(self) -> Dict[str, Any]:
        """轮询单个设备的状态数据"""
        try:
            return await self.api.async_get_device_status(self.device_id)
        except AuthenticationError as err:
            _LOGGER.warning("设备[%s]认证失效: %s，触发重新登录", self.device_id, err)
            # 触发重新认证流程
            entry = self.hass.config_entries.async_get_entry(self.entry_id)
            if entry:
                # 配置项存在时才触发重新认证
                self.hass.async_create_task(
                    self.hass.config_entries.flow.async_init(
                        DOMAIN,
                        context={"source": "reauth", "entry_id": self.entry_id},
                        data=entry.data,  # 直接使用已确认存在的 entry.data
                    )
                )
            else:
                _LOGGER.error(
                    "配置项不存在（entry_id=%s），无法触发重新认证", self.entry_id
                )
            raise UpdateFailed(f"设备[{self.device_id}]需要重新认证: {err}") from err
        except Exception as err:
            raise UpdateFailed(f"更新设备[{self.device_id}]数据失败: {err}") from err


# 传感器实体（关联到具体设备）
class DeviceSensor(CoordinatorEntity[DeviceDataCoordinator], SensorEntity):
    """关联到具体设备的传感器实体"""

    _attr_has_entity_name = True

    def __init__(
        self,
        coordinator: DeviceDataCoordinator,
        field_name: str,
        device_class: SensorDeviceClass,
        unit: str,
        state_class: SensorStateClass,
        value_transform: callable,  # type: ignore
    ):
        super().__init__(coordinator)
        self._field_name = field_name
        self._value_transform = value_transform

        # 传感器基础属性
        self._attr_device_class = device_class
        self._attr_native_unit_of_measurement = unit

        # 强制确认state_class为MEASUREMENT（测量值，HA会持续记录）
        self._attr_state_class = SensorStateClass.MEASUREMENT

        # 唯一ID：域名_设备ID_字段名（保证多设备不重复）
        self._attr_unique_id = f"{DOMAIN}_{coordinator.device_id}_{field_name}"
        # 传感器名称（友好显示）
        self._attr_name = field_name.replace("_", " ").title()

    @property
    def device_info(self) -> DeviceInfo:
        """关联到所属设备（关键：让传感器显示在对应设备下）."""
        return DeviceInfo(
            identifiers={(DOMAIN, self.coordinator.device_id)},  # 设备唯一标识
            name=self.coordinator.device_name,  # 设备名称
            manufacturer="UCAN",  # 厂商（可自定义）
            model=self.coordinator.invmodel,  # 型号（可自定义）
        )

    @property
    def native_value(self) -> Any | None:
        """获取传感器值（带转换）"""
        raw_value = self.coordinator.data.get(self._field_name)
        if raw_value is None:
            return 0
        try:
            return self._value_transform(raw_value)

        except Exception as e:
            _LOGGER.error(
                "转换设备[%s]字段[%s]失败: %s",
                self.coordinator.device_id,
                self._field_name,
                e,
            )
            return 0
