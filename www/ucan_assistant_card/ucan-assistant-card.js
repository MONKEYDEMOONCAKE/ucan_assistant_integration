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



const pageType_st = Object.freeze({
	LIST: 0,
	MAIN: 1,
	DETAILS: 2,
	ALARMS: 3,
	INFO: 4
});

const pageType_nd = Object.freeze({
	FLOW: 'flow',
	CHART: 'chart',
	BAT: 'bat',
	GRID: 'grid',
	SOLAR: 'mppt',
	LOAD: 'load'
});


const ChartType = Object.freeze({
	DAY: 'day',
	MONTH: 'month',
	YEAR: 'year',
	TOTAL: 'total',
});

// 定义核心卡片类
class UcanAssistantCard extends HTMLElement {
	constructor() {
		super();
		this.attachShadow({ mode: 'open' });

		// 状态管理
		this._hass = null;
		this._config = {};	//	卡片必备
		this._api = null; // Ucan API实例
		this._loading = false;
		this._error = null;
		this._devices = [];	// 设备列表
		this._change_flag = false;
		this._currentDevice = null;
		this._pollingInterval = null;	// 周期执行的running函数，相当于c里的while（1）
		this._pageState = { first_type: pageType_st.LIST, second_type: pageType_nd.FLOW, chart_type: ChartType.DAY, data: {} }; //分层管理页面，初始化后处于列表页
		this._chartLoaded = false; // 标记Chart.js是否已加载
		this.currentChartDate = new Date();
		this._i18n = {};	//存储翻译文本
		this._inv_model_json = {};	//存储逆变器型号json
		this._domInitialized = false;
	}

	connectedCallback() {
		this.shadowRoot.innerHTML = `<h1>UCAN Assistant</h1>`;
		this._initializeDOM();
		this._change_flag = true;
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
					this._pollingInterval = this._api.startPolling(() => this._main_running(), 500, this._pollingInterval);		// 开启主周期任务
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
		console.log("aaaaa");
		this._render();

		try {
			this._devices = await this._api.getDeviceList();
		} catch (error) {
			this._error = error.message;
		} finally {
			this._loading = false;
			console.log("bbbbb");
			this._render();
		}
	}

	// 选择设备进入详情页
	async _selectDevice(device) {
		this._loading = true;
		this._error = null;
		try {
			await this._api.selectDevice(device); // 通知后端
			this._currentDevice = device;
			this._pageState.first_type = pageType_st.MAIN; // 切换到主页
			this._pageState.second_type = pageType_nd.FLOW;
			this._change_flag = true;
		} catch (error) {
			this._error = error.message;
		} finally {
			this._loading = false;
			console.log("ccccc");
		}
	}

	// 获取功率数据并更新
	async _fetchPowerData() {
		try {
			this._pageState.data = await this._api.getDevicePower();
		} catch (error) {
			console.error('轮询功率数据失败:', error);
		} finally {
			console.log("eeeee");
			this._render();
		}
	}

	//设置历史数据时间段
	async _setHistoryTime(device, targetDate, chart_type) {

		if (this._timezone == null) {
			await this._fetchDevInfoData();
			console.warn('警告：未能获取设备时区，已强制使用零时区 (UTC+0)，数据时间可能不准确，请检查设备连接状态。');
			// 这里可以添加 UI 提示逻辑，例如：this._showToast('时区获取失败，使用默认值');
			if (this._timezone == null) {
				this._timezone = 0;
				this._timezone_effect = 0;
			}

		}
		else {
			this._timezone_effect = 1;
		}

		const result = await this._api.selectDataTimeRange(device, targetDate, this._timezone, chart_type);
		if (!result) {
			return false;
		}
		else {
			return true;
		}
	}


	//获取历史数据
	async _fetchHistoryData(deviceOffsetSecs, chart_type) {
		let result = null;
		try {
			result = await this._api.getHistoryData(deviceOffsetSecs, chart_type);
			this._pageState.data = result.data;		// 处理后符合绘图的数据
			console.log("filled:", result.filled);

		} catch (error) {
			console.error('获取功率历史数据失败:', error);
		} finally {
			console.log("kkkkk");
			this._render();
			return result.filled;
		}
	}


	//获取详细数据并更新
	async _fetchDetailData() {

		try {
			this._pageState.data = await this._api.getDetailsData();
		} catch (error) {
			console.error('获取详细数据失败:', error);
		} finally {
			console.log("99999");
			this._render();
		}
	}

	//获取告警数据
	async _fetchAlarmData() {
		try {
			this._pageState.data = await this._api.getAlarmData();
		} catch (error) {
			console.error('获取告警数据失败:', error);
		} finally {
			console.log("99999");
			this._render();
		}
	}

	//获取设备信息
	async _fetchDevInfoData() {
		try {
			this._pageState.data = await this._api.getDevInfoData();
			this._timezone = this._pageState.data.timezone;
			console.log('timezone:', this._timezone);
			this._render();
		} catch (error) {
			console.error('获取设备信息失败:', error);
		} finally {
			console.log("77777");
			this._render();
		}
	}

	// 返回列表页
	_goBack() {
		if (this._pageState.first_type == pageType_st.MAIN && this._pageState.second_type == pageType_nd.CHART) {		//返回主页
			this._pageState.second_type = pageType_nd.FLOW;
		}
		else {
			this._pageState.first_type = pageType_st.LIST;
			this._timezone = null;
			this._timezone_effect = 0;
			this._currentDevice = null;
		}
		this._change_flag = true;
		console.log("66666");
	}

	// 绑定交互事件（按钮/设备卡片点击）
	_bindEvents() {
		const shadow = this.shadowRoot;
		if (!shadow) return;

		// 返回按钮
		shadow.querySelector('.back-btn')?.addEventListener('click', () => this._goBack());
		// 刷新按钮
		shadow.querySelector('.refresh-btn')?.addEventListener('click', () => {
			this._change_flag = true;
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
					main: { first_type: pageType_st.MAIN, second_type: pageType_nd.FLOW, chart_type: ChartType.DAY, data: {} },
					details: { first_type: pageType_st.DETAILS, second_type: pageType_nd.BAT, chart_type: ChartType.DAY, data: {} },
					alarm: { first_type: pageType_st.ALARMS, second_type: pageType_nd.FLOW, chart_type: ChartType.DAY, data: {} },
					devinfo: { first_type: pageType_st.INFO, second_type: pageType_nd.FLOW, chart_type: ChartType.DAY, data: {} }
				};
				this._pageState = map[target.value] || { first_type: pageType_st.MAIN, second_type: pageType_nd.FLOW, chart_type: ChartType.DAY, data: {} };	//默认主页
				this._change_flag = true;
				console.log("55555");
			}
		});

		//统计数据日期切换
		shadow.querySelector('.prev-date')?.addEventListener('click', async () => {

			if (this._pageState.chart_type == ChartType.DAY) {
				// 1. 获取当前图表日期，切换为前一天
				const prevDate = new Date(this.currentChartDate);
				prevDate.setDate(prevDate.getDate() - 1);

				// 2. 更新当前日期跟踪属性
				this.currentChartDate = prevDate;
			}
			else if (this._pageState.chart_type == ChartType.MONTH) {
				// 1. 获取当前图表日期，切换为前一天
				const prevDate = new Date(this.currentChartDate);
				prevDate.setMonth(prevDate.getMonth() - 1);

				// 2. 更新当前日期跟踪属性
				this.currentChartDate = prevDate;
			}
			else if (this._pageState.chart_type == ChartType.YEAR) {
				// 1. 获取当前图表日期，切换为前一天
				const prevDate = new Date(this.currentChartDate);
				prevDate.setFullYear(prevDate.getFullYear() - 1);

				// 2. 更新当前日期跟踪属性
				this.currentChartDate = prevDate;
			}
			this._pageState.data = {};
			this._change_flag = true;

		});

		shadow.querySelector('.next-date')?.addEventListener('click', async () => {
			if (this._pageState.chart_type == ChartType.DAY) {
				// 1. 获取当前图表日期，切换为前一天
				const nextDate = new Date(this.currentChartDate);
				nextDate.setDate(nextDate.getDate() + 1);

				// 2. 更新当前日期跟踪属性
				this.currentChartDate = nextDate;
			}
			else if (this._pageState.chart_type == ChartType.MONTH) {
				// 1. 获取当前图表日期，切换为前一天
				const prevDate = new Date(this.currentChartDate);
				prevDate.setMonth(prevDate.getMonth() + 1);

				// 2. 更新当前日期跟踪属性
				this.currentChartDate = prevDate;
			}
			else if (this._pageState.chart_type == ChartType.YEAR) {
				// 1. 获取当前图表日期，切换为前一天
				const nextDate = new Date(this.currentChartDate);
				nextDate.setFullYear(nextDate.getFullYear() + 1);

				// 2. 更新当前日期跟踪属性
				this.currentChartDate = nextDate;
			}
			this._pageState.data = {};
			this._change_flag = true;

		});



		// 详细信息按钮
		//battery
		shadow.querySelector('.bat_btn')?.addEventListener('click', () => {
			this._pageState.second_type = pageType_nd.BAT;
			this._change_flag = true;
		});
		//mppt
		shadow.querySelector('.mppt_btn')?.addEventListener('click', () => {
			this._pageState.second_type = pageType_nd.SOLAR;
			this._change_flag = true;
		});
		//load
		shadow.querySelector('.load_btn')?.addEventListener('click', () => {
			this._pageState.second_type = pageType_nd.LOAD;
			this._change_flag = true;
		});
		//grid
		shadow.querySelector('.grid_btn')?.addEventListener('click', () => {
			this._pageState.second_type = pageType_nd.GRID;
			this._change_flag = true;
		});
		//day
		shadow.querySelector('.day_btn')?.addEventListener('click', () => {
			this._pageState.chart_type = ChartType.DAY;
			this.currentChartDate = new Date();
			this._change_flag = true;
		});
		shadow.querySelector('.month_btn')?.addEventListener('click', () => {
			this._pageState.chart_type = ChartType.MONTH;
			this.currentChartDate = new Date();
			this._change_flag = true;
		});
		shadow.querySelector('.year_btn')?.addEventListener('click', () => {
			this._pageState.chart_type = ChartType.YEAR;
			this.currentChartDate = new Date();
			this._change_flag = true;
		});
		shadow.querySelector('.total_btn')?.addEventListener('click', () => {
			this._pageState.chart_type = ChartType.TOTAL;
			this.currentChartDate = new Date();
			this._change_flag = true;
		});

		// 主页进入统计图表按钮
		const powerButtons = shadow.querySelectorAll('.power-button');
		powerButtons.forEach(button => {
			button.addEventListener('click', () => {
				this._pageState.second_type = pageType_nd.CHART;
				this._pageState.chart_type = ChartType.DAY;
				this._pageState.data = {};
				this._change_flag = true;
			});

		});
	}

	//核心运行函数
	async _main_running() {

		if (this._main_running._counter === undefined) {
			this._main_running._counter = 0;
		}

		// 新增两个静态变量渲染图表页
		if (this._main_running._setReault === undefined) {
			this._main_running._setReault = 0;
		}
		if (this._main_running._filled === undefined) {
			this._main_running._filled = 1;
		}

		console.log("first:", this._pageState.first_type, "second:", this._pageState.second_type, "chart:", this._pageState.chart_type);
		switch (this._pageState.first_type) {
			case pageType_st.LIST:
				if (this._change_flag || this._main_running._counter % 120 === 0) {
					this._loadDevices();
					this._change_flag = false;
				}
				break;
			case pageType_st.MAIN:
				if (this._pageState.second_type == pageType_nd.FLOW) {
					if (this._change_flag || this._main_running._counter % 10 === 0) {
						this._fetchPowerData();
						this._change_flag = false;
					}
				}
				else if (this._pageState.second_type == pageType_nd.CHART) {
					if (this._change_flag) {
						//1、设置数据起始结束时间
						this._main_running._setReault = 0;
						this._main_running._filled = 1;
						this._main_running._setReault = await this._setHistoryTime(this._currentDevice, this.currentChartDate, this._pageState.chart_type);
						if (this._main_running._setReault)
							this._change_flag = false;

					}
					if (this._main_running._filled && this._main_running._counter % 2 === 0 && this._main_running._setReault == 1)
						this._main_running._filled = await this._fetchHistoryData(this._timezone, this._pageState.chart_type);
				}
				break;
			case pageType_st.DETAILS:
				if (this._change_flag || this._main_running._counter % 10 === 0) {
					this._fetchDetailData();
					this._change_flag = false;
				}
				break;
			case pageType_st.ALARMS:
				if (this._change_flag || this._main_running._counter % 10 === 0) {
					this._fetchAlarmData();
					this._change_flag = false;
				}
				break;
			case pageType_st.INFO:
				if (this._change_flag || this._main_running._counter % 120 === 0) {
					this._fetchDevInfoData();
					this._change_flag = false;
				}
				break;

		}
		this._main_running._counter++;
	}


	_initializeDOM() {
		const shadow = this.shadowRoot;
		shadow.innerHTML = `
			<style>${UcanStyles}</style>
			<div class="ucan-container">
				<div id="header-slot"></div>
				<div id="content-slot"></div>
			</div>
		`;
		// 标记已初始化
		this._domInitialized = true;
	}
	// 核心渲染方法
	_render() {
		const shadow = this.shadowRoot;
		if (!shadow) return;


		 // 1. 如果 DOM 未初始化，先初始化
		if (!this._domInitialized) {
			this._initializeDOM();
		}

		// 2. 获取插槽
		const headerSlot = shadow.getElementById('header-slot');
		const contentSlot = shadow.getElementById('content-slot');
		if (!headerSlot || !contentSlot) return;

		// 拼接头部和内容
		let headerHtml = '';
		let contentHtml = '';
		console.log('当前页面状态:', this._pageState.first_type, this._pageState.second_type, this._pageState.chart_type);

		switch (this._pageState.first_type) {
			case pageType_st.LIST: // 列表页
				headerHtml = UcanRender.renderListHeader(this._i18n);
				contentHtml = UcanRender.renderDeviceList(this._i18n, this._loading, this._error, this._devices, this._inv_model_json);
				break;
			case pageType_st.MAIN: //主页
				headerHtml = UcanRender.renderMainPageHeader(this._i18n, this._pageState.first_type);
				if (this._pageState.second_type == pageType_nd.FLOW)
					contentHtml = UcanRender.renderMainPage(this._i18n, this._loading, this._error, this._currentDevice, this._pageState.data);
				else if (this._pageState.second_type == pageType_nd.CHART)
					contentHtml = UcanRender.renderCurve(this._i18n, this._loading, this._error, this._currentDevice, this._pageState.data, this.currentChartDate, this._pageState.chart_type);

				break;
			case pageType_st.DETAILS: // 详情页
				headerHtml = UcanRender.renderMainPageHeader(this._i18n, this._pageState.first_type);
				contentHtml = UcanRender.renderDetailPage(this._i18n, this._loading, this._error, this._currentDevice, this._pageState.data, this._pageState.second_type);
				break;
			case pageType_st.ALARMS: // 告警详情页
				headerHtml = UcanRender.renderMainPageHeader(this._i18n, this._pageState.first_type);
				contentHtml = UcanRender.renderDevAlarmsPage(this._i18n, this._loading, this._error, this._currentDevice, this._pageState.data);
				break;
			case pageType_st.INFO: // 设备信息页
				headerHtml = UcanRender.renderMainPageHeader(this._i18n, this._pageState.first_type);
				contentHtml = UcanRender.renderDevInfoPage(this._i18n, this._loading, this._error, this._currentDevice, this._pageState.data);
				break;

			default:
				headerHtml = UcanRender.renderListHeader(this._i18n);
				contentHtml = UcanRender.renderDeviceList(this._i18n, this._loading, this._error, this._devices);
		}

		// 3. 只更新内容区域，而不是整个 shadowRoot
		// 仅当内容真的发生变化时才更新 (防止无意义的重绘)
		if (headerSlot.innerHTML !== headerHtml) {
			headerSlot.innerHTML = headerHtml;
		}
		if (contentSlot.innerHTML !== contentHtml) {
			contentSlot.innerHTML = contentHtml;
		}

		// // 渲染完整DOM
		// shadow.innerHTML = `
		// 	<style>${UcanStyles}</style>
		// 	<div class="ucan-container">
		// 		${headerHtml}
		// 		${contentHtml}
		// 	</div>
		// `;

		if (this._pageState.first_type == pageType_st.MAIN && this._pageState.second_type == pageType_nd.CHART) {
			// 假设当 _curvePage 不是 'main' 时，显示的是曲线图
			switch (this._pageState.chart_type) {
				case ChartType.DAY:
					UcanRender.renderPowerCurve_day(this._i18n, shadow, this._pageState.data);
					break;
				case ChartType.MONTH:
					UcanRender.renderPowerCurve_month(this._i18n, shadow, this._pageState.data);
					break;
				case ChartType.YEAR:
					UcanRender.renderPowerCurve_year(this._i18n, shadow, this._pageState.data);
					break;
				case ChartType.TOTAL:
					UcanRender.renderPowerCurve_total(this._i18n, shadow, this._pageState.data);
					break;
			}

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