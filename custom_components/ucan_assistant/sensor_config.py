from homeassistant.components.sensor import SensorDeviceClass, SensorStateClass

# 固定的传感器配置表（维护这份配置即可）
# 格式：{字段名: (设备类型, 单位, 状态类, 原始值转换函数)}
DATA_FIELD_CONFIG = {
    "solar_power": (
        SensorDeviceClass.POWER,
        "W",
        SensorStateClass.MEASUREMENT,
        lambda x: x,  # 原始值直接使用
    ),
    "battery_power": (
        SensorDeviceClass.POWER,
        "W",
        SensorStateClass.MEASUREMENT,
        lambda x: x,  # 原始值直接使用
    ),
    "load_power": (
        SensorDeviceClass.POWER,
        "W",
        SensorStateClass.MEASUREMENT,
        lambda x: x,  # 原始值直接使用
    ),
    "grid_power": (
        SensorDeviceClass.POWER,
        "W",
        SensorStateClass.MEASUREMENT,
        lambda x: x,  # 原始值直接使用
    ),
    # 可根据需要添加更多字段配置
}
