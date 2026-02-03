import { UcanUtils } from './ucan-utils.js';
import { UcanApi } from './ucan-api.js';
import { UcanRender } from './ucan-render.js';
import { UcanStyles } from './ucan-styles.js';
import { loadInverterModels, loadTranslations } from './language_util.js';


const getScriptPath = () => {
    const script = document.currentScript || [...document.getElementsByTagName('script')].pop();

    // 核心修改：使用 split 和 slice 来移除最后一个部分（文件名）
    return script.src.split('/').slice(0, -1).join('/') + '/';
};

// 定义基础路径
const BASE_PATH = getScriptPath();

// 定义核心卡片类
class UcanAssistantCard extends HTMLElement {
	constructor() {
		super();
		this.attachShadow({ mode: 'open' });



		// 状态管理
		this._hass = null;
		this._config = {};
		this._api = null; // API实例
		this._devices = [];
		this._loading = false;
		this._error = null;
		this._currentDevice = null;
		this._pollingInterval = null;
		this._pageState = { type: 0, data: {} }; // 0=列表，1=详情，2=信息，3=报警, 4=设备信息
		this._curvePage = 'main';
		this._detailPage = 'bat';
		this._chartLoaded = false; // 标记Chart.js是否已加载
		this._timezone = null;
		this._timezone_effect = null; // 标记时区是否有效
		this.currentChartDate = new Date();
		this._i18n = {};	//存储翻译文本
		this._inv_model_json = {};	//存储逆变器型号json
	}

	connectedCallback() {
		this.shadowRoot.innerHTML = `<h1>UCAN Assistant</h1>`;
	}

	// HA卡片必需：设置配置
	setConfig(config) {
		this._config = config || {};
	}

	// HA卡片必需：设置hass实例
	set hass(hass) {
		this._hass = hass;

		loadTranslations(this._hass?.language).then(translations => {
			this._i18n = translations;
			//确保翻译文本加载
			loadInverterModels().then(models => {
				this._inv_model_json = models;
				//确保型号在加载列表前加载
				if (!this._api) {
					//console.log("this._i18n:", this._i18n);
					this._api = new UcanApi(hass);
					this.loadChartJS();
					this._loadDevices(); // 只有首次初始化时才加载设备
				}
			}).catch(err => {
				console.error('Error loading inverter models, please refresh:', err);
			});
		}).catch(err => {
			console.error('Error loading translations,please refresh:', err);
		});

	}

	// HA卡片必需：返回卡片尺寸
	getCardSize() {
		return 3; // 适配HA仪表盘高度
	}

	// 销毁时清理资源
	disconnectedCallback() {
		this._pollingInterval = UcanUtils.clearPolling(this._pollingInterval);
	}


	// 动态加载Chart.js（CDN方式）
	async loadChartJS() {
		if (this._chartLoaded || window.Chart) {
			this._chartLoaded = true;
			return;
		}

		// 1. 定义正确的CDN链接（Chart.js 4.4.8 + Zoom 2.0.1）
		const chartJsUrl = BASE_PATH + 'chart.umd.min.js';
		const zoomPluginUrl = BASE_PATH + 'chartjs-plugin-zoom.min.js';
		const hammerUrl = BASE_PATH + 'hammer.min.js';

		// 2. 同步加载（先加载Chart.js核心，再加载插件）
		try {

			await this.loadScript(hammerUrl);
			// 加载Chart.js
			await this.loadScript(chartJsUrl);

			// 加载Zoom插件
			await this.loadScript(zoomPluginUrl);



			// 3. 兼容不同版本的插件注册方式（关键：解决注册失败）
			if (window.Chart && window.Chart.register) {
				window.Chart.register(window.ChartZoom);	//适配器自动注册
				this._chartLoaded = true;
			}
		} catch (err) {
			console.error('Chart.js/依赖插件加载失败：', err);
			throw err;
		}
	}

	// 封装通用的脚本加载方法（避免重复代码，便于调试）
	loadScript(url) {
		return new Promise((resolve, reject) => {

			const script = document.createElement('script');
			script.src = url;
			//script.type = 'module';
			script.type = 'text/javascript';
			script.async = false; // 同步加载，保证顺序
			script.onload = () => resolve();
			script.onerror = (err) => reject(`加载脚本失败：${url}，错误：${err.message}`);
			document.head.appendChild(script);
		});
	}

	// 加载设备列表
	async _loadDevices() {
		this._loading = true;
		this._error = null;
		console.log("fffff");
		this._render();

		try {
			this._devices = await this._api.getDeviceList();
		} catch (error) {
			this._error = error.message;
		} finally {
			this._loading = false;
			console.log("eeeee");
			this._render();
		}
	}

	// 选择设备并进入详情页
	async _selectDevice(device) {
		this._loading = true;
		this._error = null;
		console.log("ddddd");
		this._render();

		try {
			await this._api.selectDevice(device); // 通知后端
			this._currentDevice = device;
			this._pageState.type = 1; // 切换到详情页

			// 启动功率轮询
			this._pollingInterval = this._api.startPolling(() => this._fetchPowerData(), 5000, this._pollingInterval);
		} catch (error) {
			this._error = error.message;
		} finally {
			this._loading = false;
			console.log("ccccc");
			this._render();
		}
	}

	// 获取功率数据并更新
	async _fetchPowerData() {
		try {
			this._pageState.data = await this._api.getDevicePower();
			console.log("bbbbb");
			this._render();
		} catch (error) {
			console.error('轮询功率数据失败:', error);
		}
	}

	//获取功率历史数据
	async _fetchAllPowerHistoryData(device, targetDate, deviceOffsetSecs) {
		if(this._timezone == 0)
			this._timezone = null;
		const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
		let cnt = 0;
    	const maxRetries = 3; // 设置最大重试次数
		try {
			while ((this._timezone == null || isNaN(this._timezone)) && cnt < maxRetries)
			{
				await this._fetchDevInfoData();
				await delay(500);
				cnt++;
			}

			if (this._timezone == null || isNaN(this._timezone)) {
				console.warn('警告：未能获取设备时区，已强制使用零时区 (UTC+0)，数据时间可能不准确，请检查设备连接状态。');
				// 这里可以添加 UI 提示逻辑，例如：this._showToast('时区获取失败，使用默认值');
				this._timezone = 0;
				this._timezone_effect = 0;
			}
			else {
				this._timezone_effect = 1;
			}

			this._pageState.data = await this._api.getAllPowerHistoryData(device, targetDate, deviceOffsetSecs);
			console.log("aaaaa");
			this._render();
		} catch (error) {
			console.error('获取功率历史数据失败:', error);
		}
	}

	//获取详细数据并更新
	async _fetchDetailData() {
		try {
			this._pageState.data = await this._api.getDetailsData();
			console.log("99999");
			this._render();
		} catch (error) {
			console.error('获取详细数据失败:', error);
		}
	}

	//获取告警数据
	async _fetchAlarmData() {
		try {
			this._pageState.data = await this._api.getAlarmData();
			console.log("88888");
			this._render();
		} catch (error) {
			console.error('获取告警数据失败:', error);
		}
	}

	//获取设备信息
	async _fetchDevInfoData() {
		try {
			this._pageState.data = await this._api.getDevInfoData();
			this._timezone = this._pageState.data.timezone || null;
			console.log('timezone:', this._timezone);
			console.log("77777");
			this._render();
		} catch (error) {
			console.error('获取设备信息失败:', error);
		}
	}

	// 返回列表页
	_goBack() {
		if (this._pageState.type == 1 && this._curvePage != 'main') {
			this._curvePage = 'main';
			this._pageState.data = {};
			this._pollingInterval = this._api.startPolling(() => this._fetchPowerData(), 5000, this._pollingInterval);
		}
		else {
			this._pollingInterval = UcanUtils.clearPolling(this._pollingInterval);
			this._pageState.type = 0;
			this._timezone = null;
			this._timezone_effect = 0;
			this._currentDevice = null;
		}
		console.log("66666");
		this._render();
	}

	// 绑定交互事件（按钮/设备卡片点击）
	_bindEvents() {
		const shadow = this.shadowRoot;
		if (!shadow) return;

		// 返回按钮
		shadow.querySelector('.back-btn')?.addEventListener('click', () => this._goBack());
		// 刷新按钮
		shadow.querySelector('.refresh-btn')?.addEventListener('click', () => {
			switch (this._pageState.type) {
				case 0:
					this._loadDevices();
					break;
				case 1:
					if(this._curvePage == 'main')
						this._fetchPowerData();
					else
						this._fetchAllPowerHistoryData(this._currentDevice, this.currentChartDate, this._timezone);
					break;
				case 2:
					this._fetchDetailData();
					break;
				case 3:
					this._fetchAlarmData();
					break;
				case 4:
					this._fetchDevInfoData();
					break;
				default:
					break;
			}
		});
		// 设备卡片点击
		shadow.querySelectorAll('.device-card').forEach(card => {
			card.addEventListener('click', () => {
				const device = this._devices.find(d => d.device_id === card.dataset.id);
				if (device) this._selectDevice(device);
			});
		});
		// 跳转选择框
		shadow.querySelector('.jump-select')?.addEventListener('change', (event) => {
			const target = event.target;
			if (target instanceof HTMLSelectElement) {
				const map = {
					main: { type: 1, data: {} },
					info: { type: 2, data: {} },
					alarm: { type: 3, data: {} },
					devinfo: { type: 4, data: {} }
				};
				this._pageState = map[target.value] || { type: 1, data: {} };	//默认主页
				this._curvePage = 'main';
				switch (this._pageState.type) {
					case 1:
						this._pollingInterval = this._api.startPolling(() => this._fetchPowerData(), 5000, this._pollingInterval);
						break;
					case 2:
						this._pollingInterval = this._api.startPolling(() => this._fetchDetailData(), 5000, this._pollingInterval);
						break;
					case 3:
						this._pollingInterval = this._api.startPolling(() => this._fetchAlarmData(), 5000, this._pollingInterval);
						break;
					case 4:
						this._pollingInterval = this._api.startPolling(() => this._fetchDevInfoData(), 30000, this._pollingInterval);
						break;
					default:
						this._pollingInterval = this._api.startPolling(() => this._fetchPowerData(), 5000, this._pollingInterval);
				}
				console.log("555551");
				this._render();
			}
		});

		//功率曲线图
		const powerButtons = shadow.querySelectorAll('.power-button');
		powerButtons.forEach(button => {
			button.addEventListener('click', () => {
				this._curvePage = 'curve';
				this._pollingInterval = UcanUtils.clearPolling(this._pollingInterval);
				this._fetchAllPowerHistoryData(this._currentDevice, this.currentChartDate, this._timezone);
			});

		});

		//日期切换
		shadow.querySelector('.prev-date')?.addEventListener('click', () => {
			// 1. 获取当前图表日期，切换为前一天
			const prevDate = new Date(this.currentChartDate);
			prevDate.setDate(prevDate.getDate() - 1);

			// 2. 更新当前日期跟踪属性
			this.currentChartDate = prevDate;

			// 3. 重新拉取前一天的数据并更新图表（复用你的getPowerHistoryData方法）
			this._fetchAllPowerHistoryData(this._currentDevice, this.currentChartDate, this._timezone);
		});

		shadow.querySelector('.next-date')?.addEventListener('click', () => {
			// 1. 获取当前图表日期，切换为后一天
			const nextDate = new Date(this.currentChartDate);
			nextDate.setDate(nextDate.getDate() + 1);

			// 2. 更新当前日期跟踪属性
			this.currentChartDate = nextDate;
			// 3. 重新拉取前一天的数据并更新图表（复用你的getPowerHistoryData方法）
			this._fetchAllPowerHistoryData(this._currentDevice, this.currentChartDate, this._timezone);
		});

		// 详细信息按钮
		//battery
		shadow.querySelector('.bat_btn')?.addEventListener('click', () => {
			this._detailPage = 'bat';
			console.log("44444");
			this._render();
		});
		//mppt
		shadow.querySelector('.mppt_btn')?.addEventListener('click', () => {
			this._detailPage = 'mppt';
			console.log("33333");
			this._render();
		});
		//load
		shadow.querySelector('.load_btn')?.addEventListener('click', () => {
			this._detailPage = 'load';
			console.log("222222");
			this._render();
		});
		//grid
		shadow.querySelector('.grid_btn')?.addEventListener('click', () => {
			this._detailPage = 'grid';
			console.log("111111");
			this._render();
		});
	}

	// 核心渲染方法
	_render() {
		const shadow = this.shadowRoot;
		if (!shadow) return;

		// 拼接头部和内容
		let headerHtml = '';
		let contentHtml = '';
		console.log('当前页面状态:', this._pageState, this._curvePage);

		switch (this._pageState.type) {
			case 0: // 列表页
				headerHtml = UcanRender.renderListHeader(this._i18n);
				contentHtml = UcanRender.renderDeviceList(this._i18n, this._loading, this._error, this._devices, this._inv_model_json);
				break;
			case 1: // 主页
				headerHtml = UcanRender.renderMainPageHeader(this._i18n, this._pageState.type);
				if (this._curvePage == 'main') {
					contentHtml = UcanRender.renderMainPage(this._i18n, this._loading, this._error, this._currentDevice, this._pageState.data);
				}
				else {
					contentHtml = UcanRender.renderCurve(this._i18n, this._loading, this._error, this._currentDevice, this._pageState.data, this.currentChartDate, this._timezone_effect);
				}
				break;
			case 2: // 详情页
				headerHtml = UcanRender.renderMainPageHeader(this._i18n, this._pageState.type);
				contentHtml = UcanRender.renderDetailPage(this._i18n, this._loading, this._error, this._currentDevice, this._pageState.data, this._detailPage);
				break;
			case 3: // 告警详情页
				headerHtml = UcanRender.renderMainPageHeader(this._i18n, this._pageState.type);
				contentHtml = UcanRender.renderDevAlarmsPage(this._i18n, this._loading, this._error, this._currentDevice, this._pageState.data);
				break;
			case 4: // 设备信息页
				headerHtml = UcanRender.renderMainPageHeader(this._i18n, this._pageState.type);
				contentHtml = UcanRender.renderDevInfoPage(this._i18n, this._loading, this._error, this._currentDevice, this._pageState.data);
				break;
			default:
				headerHtml = UcanRender.renderListHeader(this._i18n);
				contentHtml = UcanRender.renderDeviceList(this._i18n, this._loading, this._error, this._devices);
		}



		// 渲染完整DOM
		shadow.innerHTML = `
			<style>${UcanStyles}</style>
			<div class="ucan-container">
				${headerHtml}
				${contentHtml}
			</div>
		`;

		if (this._pageState.type === 1 && this._curvePage !== 'main') {
			// 假设当 _curvePage 不是 'main' 时，显示的是曲线图
			UcanRender.renderPowerCurve(this._i18n, shadow, this._pageState.data);
		}

		// 绑定事件
		this._bindEvents();
	}

}

// 注册自定义卡片（HA必需）
if (!customElements.get('ucan-assistant-card')) {
	customElements.define('ucan-assistant-card', UcanAssistantCard);
}


// 导出卡片类（供HA识别）
export default UcanAssistantCard;