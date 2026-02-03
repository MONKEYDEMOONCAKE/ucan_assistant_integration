"""Constants for the ucan assistant integration."""

DOMAIN = "ucan_assistant"


# 配置键
CONF_SIGN = "user name"
CONF_PASSWORD = "password"
CONF_TOKEN = "token"
CONF_ROLE = "role"
CONF_LEVEL = "level"

# 角色定义
ROLES = {
    "ADMIN": "管理员",
    "PRL_AGENT": "主要代理",
    "SEC_AGENT": "次要代理",
    "INSTALLER": "安装者",
    "OPS": "运维",
    "MEMBER": "成员",
}

DEFAULT_SCAN_INTERVAL = 5  # 秒  API
SENSOR_SCAN_INTERVAL = 60

# API endpoints
API_BASE_URL = "https://app.ucaness.com"
API_SIGNIN = "/user/signin"
API_DEVICE_STATUS = "/device/status"
API_DEVICE_LIST = "/v2/device/list"
API_DEVICE_CONFIG = "/device/config"
API_DEVICE_INFO = "/device/info"
API_DEVICE_DETAILS = "/device/pcs/detail"
API_DEVICE_ALARMS = "/report/event2"

# 成功码
ERROR_CODE_SUCCESS_STR = "2000"
ERROR_CODE_SUCCESS = 2000

DATA_CACHE = f"{DOMAIN}_cache"
DATA_UPDATE_TASK = f"{DOMAIN}_update_task"
CACHE_CURRENT_DEVICE = "current_device"  # 对应缓存中的key
CACHE_DEVICE_LIST = "device_list"
CACHE_DEVICE_STATUS = "device_status"
CACHE_DEVICE_INFO = "device_info"
CACHE_DEVICE_DETAILS = "device_details"
CACHE_DEVICE_ALARMS = "device_alarms"

WEB_API_BASE_URL = "/api/ucan_assistant"
WEB_API_BASE_NAME = "api:ucan_assistant"
