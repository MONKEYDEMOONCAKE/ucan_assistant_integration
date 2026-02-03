"""Config flow for the ucan server data integration."""

from __future__ import annotations
import logging
from typing import Any

import voluptuous as vol

from homeassistant import config_entries
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError
from homeassistant.config_entries import ConfigFlowResult

from .api import UcanServerApiClient, AuthenticationError
from .const import (
    DOMAIN,
    CONF_SIGN,
    CONF_PASSWORD,
    API_BASE_URL,
    CONF_TOKEN,
    CONF_ROLE,
)


_LOGGER = logging.getLogger(__name__)

# TODO adjust the data schema to the data that you need
STEP_USER_DATA_SCHEMA = vol.Schema(
    {
        vol.Required(CONF_SIGN): str,  # 账号
        vol.Required(CONF_PASSWORD): str,  # 密码
    }
)


async def validate_input(hass: HomeAssistant, data: dict[str, Any]) -> dict[str, Any]:
    """Validate the user input allows us to connect."""
    host = API_BASE_URL

    session = async_get_clientsession(hass)  # 获取官方默认http 客户端
    api = UcanServerApiClient(session, host)

    try:
        auth_info = await api.async_signin(data[CONF_SIGN], data[CONF_PASSWORD])

        return {
            "title": f"UCAN Server - {data[CONF_SIGN]}",
            CONF_SIGN: data[CONF_SIGN],
            CONF_PASSWORD: data[CONF_PASSWORD],
            CONF_TOKEN: auth_info.get("token"),
            CONF_ROLE: auth_info.get("role"),
        }

    except AuthenticationError as err:
        if "密码" in str(err) or "账号" in str(err):
            raise InvalidAuth from err
        raise CannotConnect from err
    except Exception as err:
        _LOGGER.exception("connect to ucan server failed")
        raise CannotConnect from err


class UcanAssistantDataConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a config flow for ucan server data."""

    VERSION = 1
    reauth_entry: config_entries.ConfigEntry | None = None

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Handle the initial step."""
        errors: dict[str, str] = {}
        if user_input is not None:
            try:
                info = await validate_input(self.hass, user_input)
            except CannotConnect:
                errors["base"] = "cannot_connect"
            except InvalidAuth:
                errors["base"] = "invalid_auth"
            except Exception:
                _LOGGER.exception("Unexpected exception")
                errors["base"] = "unknown"
            else:
                return self.async_create_entry(title=info["title"], data=info)

        return self.async_show_form(
            step_id="user", data_schema=STEP_USER_DATA_SCHEMA, errors=errors
        )

    async def async_step_reauth(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """重新认证入口步骤（触发reauth时首先调用）."""
        entry_id = self.context.get("entry_id")
        if not entry_id:
            _LOGGER.error("重新认证流程缺少entry_id，无法继续")
            return self.async_abort(reason="reauth_failed")  # 终止流程并提示失败

        # 保存当前需要重新认证的配置项
        self.reauth_entry = self.hass.config_entries.async_get_entry(entry_id)
        if not self.reauth_entry:
            _LOGGER.error("找不到entry_id为%s的配置项，无法重新认证", entry_id)
            return self.async_abort(reason="reauth_failed")

        # 跳转到重新认证确认步骤
        return await self.async_step_reauth_confirm()

    # 修改 config_flow.py 中的 async_step_reauth_confirm 方法
    async def async_step_reauth_confirm(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """重新认证确认步骤（显示登录表单）"""
        errors = {}
        if user_input is None:
            if not self.reauth_entry:
                _LOGGER.error("重新认证配置项不存在，无法加载表单")
                return self.async_abort(reason="reauth_failed")

            # 安全获取默认值
            default_sign = (
                self.reauth_entry.data.get(CONF_SIGN) if self.reauth_entry.data else ""
            )

            return self.async_show_form(
                step_id="reauth_confirm",
                data_schema=vol.Schema(
                    {
                        vol.Required(CONF_SIGN, default=default_sign): str,
                        vol.Required(CONF_PASSWORD): str,
                    }
                ),
            )

        # 修复变量引用错误
        try:
            # 使用正确的变量和API初始化
            host = API_BASE_URL
            session = async_get_clientsession(self.hass)
            api = UcanServerApiClient(session, host)
            auth_info = await api.async_signin(
                user_input[CONF_SIGN], user_input[CONF_PASSWORD]
            )

            # 更新现有配置项
            if self.reauth_entry:
                self.hass.config_entries.async_update_entry(
                    self.reauth_entry,
                    data={
                        **self.reauth_entry.data,
                        **user_input,
                        "token": auth_info.get("token"),
                    },
                )
                # 重新加载配置项
                await self.hass.config_entries.async_reload(self.reauth_entry.entry_id)
                return self.async_abort(reason="reauth_successful")

        except AuthenticationError as err:
            if "密码" in str(err) or "账号" in str(err):
                errors["base"] = "invalid_auth"
            else:
                errors["base"] = "cannot_connect"
        except Exception as err:
            _LOGGER.exception("重新认证失败")
            errors["base"] = "unknown"

        return self.async_show_form(
            step_id="reauth_confirm",
            data_schema=vol.Schema(
                {
                    vol.Required(CONF_SIGN, default=user_input.get(CONF_SIGN)): str,
                    vol.Required(CONF_PASSWORD): str,
                }
            ),
            errors=errors,
        )


class CannotConnect(HomeAssistantError):
    """Error to indicate we cannot connect."""


class InvalidAuth(HomeAssistantError):
    """Error to indicate there is invalid auth."""
