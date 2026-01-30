import { UcanUtils } from './ucan-utils.js';

// 导出渲染方法
export const UcanRender = {
    // 渲染列表页头部 ok
    renderListHeader(translations) {
        return `
            <div class="header">
                <h2 class="title">${translations.my_devices}</h2>
                <button class="refresh-btn">${translations.refresh_devices}</button>
            </div>
        `;
    },

    // 渲染主页头部 ok
    renderMainPageHeader(translations, pageType) {
        return `
        <div class="header">
            <h2 class="title">${translations.main}</h2>
            <div>
                <select class="jump-select">
                    <option value="main" ${pageType === 1 ? 'selected' : ''}>${translations.main}</option>
                    <option value="info" ${pageType === 2 ? 'selected' : ''}>${translations.info}</option>
                    <option value="alarm" ${pageType === 3 ? 'selected' : ''}>${translations.alarm}</option>
                    <option value="devinfo" ${pageType === 4 ? 'selected' : ''}>${translations.devinfo}</option>
                </select>
                <button class="refresh-btn">${translations.refresh_data}</button>
                <button class="back-btn">${translations.back}</button>
            </div>
        </div>
        `;
    },

    // 渲染设备列表 ok
    renderDeviceList(translations, loading, error, devices, model_json) {
        if (loading) {
            return `<div class="loading">${translations.loading}... <span class="spinner"></span></div>`;
        }
        if (error) {
            return `<div class="error">${error}</div>`;
        }
        if (devices.length === 0) {
            return `<div class="no-devices">${translations.cant_find_dev}</div>`;
        }

        return `
            <div class="device-list-page">
                <div class="device-list">
                    ${devices.map(device => `
                        <div class="device-card" data-id="${device.device_id}" data-sn="${device.device_sn}">
                            <div class="device-sn">
                                <span>SN: ${device.device_sn}</span>
                                <span>(${model_json[device.inverter_model] || "---"})</span>
                            </div>
                            <div class="device-soc">
                                ${translations.soc}: <span class="soc-value ${UcanUtils.getSocClass(device.soc/10)}">${device.soc/10}%</span>
                            </div>
                            <div class="device-status">
                                ${translations.state}: ${device.is_online ?
                                    `<span style="color: var(--success-color)">${translations.online}</span>` :
                                    `<span style="color: var(--error-color)">${translations.offline}</span>`
                                }
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    },

    // 渲染设备主页 ok
    renderMainPage(translations, loading, error, currentDevice, powerData) {
        if (loading) {
            return `<div class="loading">${translations.loading}... <span class="spinner"></span></div>`;
        }
        if (error) {
            return `<div class="error">${error}</div>`;
        }
        if (!currentDevice) {
            return `<div class="no-device-selected">${translations.havnt_select_dev}</div>`;
        }

        return `
            <div class="energy-main-page">
                <div class="device-info">
                    <div class="device-name">${currentDevice.device_sn || translations.uknown_dev}</div>
                    <div class="device-soc-detail">
                        ${translations.soc}: <span class="soc-value ${UcanUtils.getSocClass(currentDevice.soc/10)}">${currentDevice.soc/10}%</span>
                    </div>
                </div>

                <div class="energy-flow-container">
                    <div class="flow-title">${translations.energy_flow}</div>
                    <div class="flow-graph">
                        <!-- 中心：房子元素 -->
                        <div class="house">
                            <div class="house-shape"></div>
                            <svg class="energy-svg" viewBox="0 0 450 391">
                                <!-- 1. 电网  -->
                                ${powerData.grid !== 0 ? `
                                    <!-- 动态路径：根据grid正负切换，设置唯一id供动画引用 -->
                                    <path
                                        class="hidden-path"
                                        id="path-grid"
                                        d="${powerData.grid > 0 ? 'M 380 70 L 380 165 L 330 170' : 'M 330 170 L 380 163 L 380 70'}"
                                    />
                                    <!-- 小球：仅当grid≠0时渲染，绑定动态路径动画 -->
                                    <circle class="flow-dot">
                                        <animateMotion
                                            dur="2.5s"
                                            repeatCount="indefinite"
                                            begin="0.01s"
                                            fill="remove"
                                        >
                                            <mpath href="#path-grid" />
                                        </animateMotion>
                                    </circle>
                                ` : ''}
                                <!-- 2. 光伏  -->
                                ${powerData.solar !== 0 ? `
                                    <!-- 动态路径：根据grid正负切换，设置唯一id供动画引用 -->
                                    <path
                                        class="hidden-path"
                                        id="path-pv"
                                        d="${powerData.solar > 0 ? 'M 320 80 L 315 170' : 'M 315 170 L 320 80'}"
                                    />
                                    <!-- 小球：仅当grid≠0时渲染，绑定动态路径动画 -->
                                    <circle class="pv-flow-dot">
                                        <animateMotion
                                            dur="2.5s"
                                            repeatCount="indefinite"
                                            begin="0.01s"
                                            fill="remove"
                                        >
                                            <mpath href="#path-pv" />
                                        </animateMotion>
                                    </circle>
                                ` : ''}
                                <!-- 3. 电池  -->
                                ${powerData.battery !== 0 ? `
                                    <!-- 动态路径：根据grid正负切换，设置唯一id供动画引用 -->
                                    <path
                                        class="hidden-path"
                                        id="path-bat"
                                        d="${powerData.battery > 0 ? 'M 310 175 L 240 180' : 'M 240 180 L 310 175'}"
                                    />
                                    <!-- 小球：仅当grid≠0时渲染，绑定动态路径动画 -->
                                    <circle class="flow-dot">
                                        <animateMotion
                                            dur="2.5s"
                                            repeatCount="indefinite"
                                            begin="0.01s"
                                            fill="remove"
                                        >
                                            <mpath href="#path-bat" />
                                        </animateMotion>
                                    </circle>
                                ` : ''}
                                <!-- 4. 负载  -->
                                ${powerData.load !== 0 ? `
                                    <!-- 动态路径：根据grid正负切换，设置唯一id供动画引用 -->
                                    <path
                                        class="hidden-path"
                                        id="path-load"
                                        d="${powerData.load > 0 ? 'M 320 185 L 350 185' : 'M 350 185 L 320 185'}"
                                    />
                                    <!-- 小球：仅当grid≠0时渲染，绑定动态路径动画 -->
                                    <circle class="flow-dot">
                                        <animateMotion
                                            dur="1.25s"
                                            repeatCount="indefinite"
                                            begin="0.01s"
                                            fill="remove"
                                        >
                                            <mpath href="#path-load" />
                                        </animateMotion>
                                    </circle>
                                ` : ''}
                            </svg>
                        </div>

                        <!-- 1. 太阳能 -->
                        <div class="flow-node solar-node">
                            <div class="node-label">${translations.solar}</div>
                            <div class="node-value ${UcanUtils.getPowerClass(powerData.solar)}">${powerData.solar}W</div>
                        </div>

                        <!-- 2. 电网 -->
                        <div class="flow-node grid-node">
                            <div class="node-label">${translations.grid}</div>
                            <div class="node-value ${UcanUtils.getPowerClass(powerData.grid)}">${powerData.grid}W</div>
                        </div>

                        <!-- 3. 电池 -->
                        <div class="flow-node battery-node">
                            <div class="node-label">${translations.battery}</div>
                            <div class="node-value ${UcanUtils.getPowerClass(powerData.battery)}">${powerData.battery}W</div>
                        </div>

                        <!-- 4. 负载 -->
                        <div class="flow-node load-node">
                            <div class="node-label">${translations.load}</div>
                            <div class="node-value ${UcanUtils.getPowerClass(powerData.load)}">${powerData.load}W</div>
                        </div>
                    </div>
                </div>

                <div class="power-list">
                    <div class="power-item">
                        <div class="power-label">${translations.grid_power}</div>
                        <div class="power-value ${UcanUtils.getPowerClass(powerData.grid)}">${powerData.grid}W</div>
                        <button class="power-button">></button>
                    </div>
                    <div class="power-item">
                        <div class="power-label">${translations.load_power}</div>
                        <div class="power-value ${UcanUtils.getPowerClass(powerData.load)}">${powerData.load}W</div>
                        <button class="power-button">></button>
                    </div>
                    <div class="power-item">
                        <div class="power-label">${translations.solar_power}</div>
                        <div class="power-value ${UcanUtils.getPowerClass(powerData.solar)}">${powerData.solar}W</div>
                        <button class="power-button">></button>
                    </div>
                    <div class="power-item">
                        <div class="power-label">${translations.battery_power}</div>
                        <div class="power-value ${UcanUtils.getPowerClass(powerData.battery)}">${powerData.battery}W</div>
                        <button class="power-button">></button>
                    </div>
                </div>
            </div>
        `;
    },

    //ok
    renderCurve(translations, loading, error, device, data, date, timezone_effect) {
        const chartContainer = document.getElementById('powerChart');
        console.log('start render curve')
        if (loading) {
            return `<div class="loading">${translations.loading}...</div>`;
        }
        if (error) {
            return `<div class="error">${error}</div>`;
        }
        if (!device || !data) {
            return `<div class="no-data">${translations.no_dev_data}</div>`;
        }

        const formattedDate = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;

        return `
            <div class = "energy-curve-page">
                <div class="chart-container">
                    <!-- 给 canvas 一个固定的高度或者用 CSS 控制 -->
                    <canvas id="powerCurveChart" height="500"></canvas>
                </div>
            </div>
            <div class="date-selector">
                <button class="date-btn prev-date">‹</button>
                <span class="current-date">${formattedDate}</span>
                <button class="date-btn next-date">›</button>
            </div>
            <div></div>
            ${timezone_effect == 0 ? `<div class="text-center">${translations.timezone_err}</div>` : ''}
        `;


    },

    //ok
    renderPowerCurve(translations, shadow, data) {
        const canvas = shadow.getElementById('powerCurveChart');
        if (!canvas) {
            console.warn('未找到图表容器 #powerCurveChart');
            return;
        }
        console.log("data:", data)

        // 如果已有图表实例，先销毁以防止内存泄漏或重叠
        if (window.powerChartInstance) {
            window.powerChartInstance.destroy();
        }

        // 定义默认传感器颜色（可扩展，按顺序分配给不同传感器）
        const sensorColors = [
            { border: '#2196F3', bg: 'rgba(33, 150, 243, 0.1)' }, // 蓝色（grid）
            { border: '#4CAF50', bg: 'rgba(76, 175, 80, 0.1)' }, // 绿色（pv）
            { border: '#FF9800', bg: 'rgba(255, 152, 0, 0.1)' }, // 橙色（bat）
            { border: '#F44336', bg: 'rgba(244, 67, 54, 0.1)' }  // 红色（load）
        ];

        // 标准化数据：将单传感器数据转为多传感器格式，减少改动
        let sensorList = [];
        if (data && Array.isArray(data.timeline) && Array.isArray(data.values)) {
            // 兼容原有单传感器数据格式
            sensorList = [{
                label: '功率 (W)',
                timeline: multiSensorData.timeline,
                values: multiSensorData.values
            }];
        } else if (data && Array.isArray(data)) {
            // 多传感器数据格式（推荐）：[{label: '传感器1', timeline: [], values: []}, ...]
            sensorList = data.filter(item =>
                item && Array.isArray(item.timeline) && Array.isArray(item.values) && item.timeline.length > 0
            );
        }

        // 防御性编程：检查数据是否存在
        if (sensorList.length === 0) {
            canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
            canvas.getContext('2d').font = "16px sans-serif";
            canvas.getContext('2d').textAlign = "center";
            canvas.getContext('2d').textBaseline = "middle";
            canvas.getContext('2d').fillText(`${translations.no_data_yet}`, canvas.width / 2, canvas.height / 2);
            return;
        }

        //共享时间轴
        const commonLabels = sensorList[0].timeline;
        //多传感器数据值
        const datasets = sensorList.map((sensor, index) => {
            console.log('sensor data:', sensor);
            const color = sensorColors[index % sensorColors.length]; // 循环分配颜色
            return {
                label: sensor.label || `${translations.power_sensor}${index+1} (W)`, // 传感器标签（图例显示）
                data: sensor.values, // 当前传感器的Y轴数值
                borderColor: color.border, // 独立线条颜色
                backgroundColor: color.bg, // 独立填充颜色
                tension: 0.4, // 保留贝塞尔曲线弯曲度
                fill: true,
                pointRadius: 1, // 保留数据点大小
                pointHoverRadius: 5 // 保留悬停数据点大小
            };
        });

        // 创建图表
        try {

            const zoomPlugin = window.ChartZoom;

            window.powerChartInstance = new Chart(canvas, {
                type: 'line',
                data: {
                    labels: commonLabels, // X轴：时间点
                    datasets: datasets
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        zoom: {
                            // 启用缩放（双指/鼠标滚轮）
                            zoom: {
                                wheel: {
                                    enabled: true, // 启用鼠标滚轮缩放
                                    speed: 0.1     // 滚轮速度
                                },
                                pinch: {
                                    enabled: true // 启用双指缩放
                                },
                                mode: 'x',     // 仅在 X 轴（时间轴）缩放
                            },
                            // 启用拖拽（平移）
                            pan: {
                                enabled: true,
                                mode: 'x',     // 仅在 X 轴拖拽
                                threshold: 10  // 拖拽灵敏度阈值
                            }
                        },
                        legend: {
                            display: true // 显示图例，因为多个数据集
                        },
                        tooltip: {
                            backgroundColor: 'rgba(0,0,0,0.8)',
                            titleColor: '#fff',
                            bodyColor: '#fff',
                            borderColor: '#2196F3',
                            borderWidth: 1,
                            callbacks: {
                                label: function(context) {
                                    return `${translations.power}: ${context.parsed.y} W`;
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: {
                                color: 'rgba(0, 0, 0, 0.05)'
                            },
                            ticks: {
                                color: '#555',
                                callback: function(value) {
                                    return value + 'W';
                                }
                            }
                        },
                        x: {
                            grid: {
                                display: false
                            },
                            ticks: {
                                color: '#555'
                            },
                            bounds: 'data',
                        }
                    },
                    interaction: {
                        intersect: false,
                        mode: 'index'
                    }
                }
            });

            canvas.ondblclick = function() {
                if (window.powerChartInstance) {
                    window.powerChartInstance.resetZoom(); // 双击恢复原始视图
                }
            };
        } catch (err) {
            console.error('图表绘制失败:', err);
            // 如果绘制失败，显示错误文本
            canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
            canvas.getContext('2d').font = "14px sans-serif";
            canvas.getContext('2d').fillStyle = "red";
            canvas.getContext('2d').textAlign = "center";
            canvas.getContext('2d').textBaseline = "middle";
            canvas.getContext('2d').fillText(`${translations.curve_load_fail}`, canvas.width / 2, canvas.height / 2);
        }
    },


    //渲染数据详情页
    renderDetailPage(translations, loading, error, device, data, detailPage) {
        if (loading) {
            return `<div class="loading">${translations.loading}...</div>`;
        }
        if (error) {
            return `<div class="error">${error}</div>`;
        }
        if (!device || !data) {
            return `<div class="no-data">${translations.no_dev_data}</div>`;
        }

        return `
            <div class="energy-main-page">
                <div class="detail-button">
                    <button class="bat_btn">bat</button>
                    <button class="mppt_btn">mppt</button>
                    <button class="load_btn">load</button>
                    <button class="grid_btn">grid</button>
                </div>
                <div class="detail-content">
                    ${UcanRender.renderDetailContent(translations, data, detailPage, device)}
                </div>
            </div>

        `;
    },

    renderDetailContent(translations, data, detailPage, device) {
        console.log("inv:", device.inverter_model);
        switch (detailPage) {
            case 'bat':
                return this.renderBatDetails(translations, data['bat'], device);
            case 'mppt':
                return this.renderMpptDetails(translations, data['mppt'], device);
            case 'load':
                return this.renderLoadDetails(translations, data['load'], device);
            case 'grid':
                return this.renderGridDetails(translations, data['grid'], device);
            default:
                return `<div class="no-data">${translations.no_detail_data}</div>`;
        }
    },

    //ok
    renderBatDetails(details, detaildata, device) {
        if (!detaildata || detaildata.length == 0) {
            return `<div class="no-data">${details.no_detail_data}</div>`;
        }
        return `
            <div class="info-list">
                ${detaildata.map((battery, index) => {
                    const batTitle = `bat${index + 1}`;
                    return `
                        <div class="info-title">${batTitle}</div>
                        <div class="info-item">
                            <span class="info-label">${details.volt}</span>
                            <span class="info-value">${battery.pack_voltage/10 || 0}V</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">${details.current}</span>
                            <span class="info-value">${battery.pack_current/10 || 0}A</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">${details.power}</span>
                            <span class="info-value">${battery.pack_power || 0}W</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">SOC</span>
                            <span class="info-value">${battery.soc/10 || 0}%</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">${details.max_chg_volt}</span>
                            <span class="info-value">${battery.max_charge_voltage/10 || 0}V</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">${details.max_chg_cur}</span>
                            <span class="info-value">${battery.max_charge_current/10 || 0}A</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">${details.min_dsg_volt}</span>
                            <span class="info-value">${battery.min_discharge_voltage/10 || 0}A</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">${details.max_dsg_cur}</span>
                            <span class="info-value">${battery.max_discharge_current/10 || 0}A</span>
                        </div>
                        ${device.inverter_model === 'mr' ? `
                            <div class="info-item">
                                <span class="info-label">${details.max_cell_volt}</span>
                                <span class="info-value">${battery.max_cell_voltage || "---"}mV</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">${details.min_cell_volt}</span>
                                <span class="info-value">${battery.min_cell_voltage || "---"}mV</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">${details.max_cell_temp}</span>
                                <span class="info-value">${battery.max_cell_temp/10 || "---"}℃</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">${details.min_cell_temp}</span>
                                <span class="info-value">${battery.min_cell_temp/10 || "---"}℃</span>
                            </div>
                            ` : ``}
                        ${(device.inverter_model === 'tq' || device.inverter_model === 'uhc-3-hv')? `
                            <div class="info-item">
                                <span class="info-label">SOH</span>
                                <span class="info-value">${battery.soh/10 || 0}%</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">${details.max_cell_volt}</span>
                                <span class="info-value">${battery.max_cell_voltage || "---"}mV</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">${details.max_cell_volt_no}</span>
                                <span class="info-value">${battery.max_cell_voltage_no || "---"}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">${details.min_cell_volt}</span>
                                <span class="info-value">${battery.min_cell_voltage || "---"}mV</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">${details.min_cell_volt_no}</span>
                                <span class="info-value">${battery.min_cell_voltage_no || "---"}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">${details.max_cell_temp}</span>
                                <span class="info-value">${battery.max_cell_temp/10 || "---"}℃</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">${details.max_cell_temp_no}</span>
                                <span class="info-value">${battery.max_cell_temp_no || "---"}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">${details.min_cell_temp}</span>
                                <span class="info-value">${battery.min_cell_temp/10 || "---"}℃</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">${details.min_cell_temp_no}</span>
                                <span class="info-value">${battery.min_cell_temp_no || "---"}</span>
                            </div>
                            ` : ``}
                        ${device.inverter_model === 'uhc-3-hv' ? `
                            <div class="info-item">
                                <span class="info-label">${details.capacity}</span>
                                <span class="info-value">${battery.capacity || 0}Ah</span>
                            </div>
                            ` : ``}
                    `;
                }).join('')}
            </div>
        `;
    },

    //ok
    renderMpptDetails(details, detaildata, device) {
        if (!detaildata) {
            return `<div class="no-data">${details.no_detail_data}</div>`;
        }
        return `
            <div class="info-list">
                <div class="info-title">PV1</div>
                <div class="info-item">
                    <span class="info-label">${details.volt_in}</span>
                    <span class="info-value">${detaildata.PV1_voltage || 0}V</span>
                </div>
                <div class="info-item">
                    <span class="info-label">${details.cur_in}</span>
                    <span class="info-value">${detaildata.PV1_current || 0}A</span>
                </div>
                <div class="info-item">
                    <span class="info-label">${details.power_in}</span>
                    <span class="info-value">${detaildata.PV1_power || 0}W</span>
                </div>
                <div class="info-title">PV2</div>
                <div class="info-item">
                    <span class="info-label">${details.volt_in}</span>
                    <span class="info-value">${detaildata.PV2_voltage || 0}V</span>
                </div>
                <div class="info-item">
                    <span class="info-label">${details.cur_in}</span>
                    <span class="info-value">${detaildata.PV2_current || 0}A</span>
                </div>
                <div class="info-item">
                    <span class="info-label">${details.power_in}</span>
                    <span class="info-value">${detaildata.PV2_power || 0}W</span>
                </div>
                ${(device.inverter_model === 'uhc-3-hv') ? `
                    <div class="info-title">PV3</div>
                    <div class="info-item">
                        <span class="info-label">${details.volt_in}</span>
                        <span class="info-value">${detaildata.PV3_voltage || 0}V</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">${details.cur_in}</span>
                        <span class="info-value">${detaildata.PV3_current || 0}A</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">${details.power_in}</span>
                        <span class="info-value">${detaildata.PV3_power || 0}W</span>
                    </div>
                    <div class="info-title">PV4</div>
                    <div class="info-item">
                        <span class="info-label">${details.volt_in}</span>
                        <span class="info-value">${detaildata.PV4_voltage || 0}V</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">${details.cur_in}</span>
                        <span class="info-value">${detaildata.PV4_current || 0}A</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">${details.power_in}</span>
                        <span class="info-value">${detaildata.PV4_power || 0}W</span>
                    </div>
                    ` : ``}
                <div class="info-title">on grid</div>
                ${(device.inverter_model === 'tq' || device.inverter_model === 'uhc-3-hv') ? `
                    <div class="info-grid">
                        <span class="info-label">${details.volt_a}</span>
                        <span class="info-value">${detaildata.on_grid.voltage_u || 0}V</span>
                        <span class="info-label">${details.curr_a}</span>
                        <span class="info-value">${detaildata.on_grid.current_u || 0}A</span>
                        <span class="info-label">${details.power_a}</span>
                        <span class="info-value">${detaildata.on_grid.power_u || 0}W</span>
                    </div>
                    <div class="info-grid">
                        <span class="info-label">${details.volt_b}</span>
                        <span class="info-value">${detaildata.on_grid.voltage_v || 0}V</span>
                        <span class="info-label">${details.curr_b}</span>
                        <span class="info-value">${detaildata.on_grid.current_v || 0}A</span>
                        <span class="info-label">${details.power_b}</span>
                        <span class="info-value">${detaildata.on_grid.power_v || 0}W</span>
                    </div>
                    <div class="info-grid">
                        <span class="info-label">${details.volt_c}</span>
                        <span class="info-value">${detaildata.on_grid.voltage_w || 0}V</span>
                        <span class="info-label">${details.curr_c}</span>
                        <span class="info-value">${detaildata.on_grid.current_w || 0}A</span>
                        <span class="info-label">${details.power_c}</span>
                        <span class="info-value">${detaildata.on_grid.power_w || 0}W</span>
                    </div>
                    ` : ``}
                ${device.inverter_model === 'mr' ? `
                    <div class="info-item">
                        <span class="info-label">${details.volt_in}</span>
                        <span class="info-value">${detaildata.on_grid.voltage_v || 0}V</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">${details.cur_in}</span>
                        <span class="info-value">${detaildata.on_grid.current_v || 0}A</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">${details.power_in}</span>
                        <span class="info-value">${detaildata.on_grid.power_v || 0}W</span>
                    </div>
                    ` : ``}

            </div>
        `;
    },

    renderLoadDetails(details, detaildata, device) {
        if (!detaildata) {
            return `<div class="no-data">${details.no_detail_data}</div>`;
        }

        return `
            <div class="info-list">
                <div class="info-title">Backup</div>
                ${device.inverter_model === 'mr' ? `
                    <div class="info-item">
                        <span class="info-label">${details.volt}</span>
                        <span class="info-value">${detaildata.voltage_v || 0}V</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">${details.current}</span>
                        <span class="info-value">${detaildata.current_v || 0}A</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">${details.power}</span>
                        <span class="info-value">${detaildata.power_v || 0}W</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">${details.rate}</span>
                        <span class="info-value">${detaildata.rate_v || 0}V</span>
                    </div>
                    ` : ``}
                ${device.inverter_model === 'tq' || device.inverter_model === 'uhc-3-hv' ? `
                    <div class="info-grid">
                        <span class="info-label">${details.volt_a}</span>
                        <span class="info-value">${detaildata.voltage_u || 0}V</span>
                        <span class="info-label">${details.curr_a}</span>
                        <span class="info-value">${detaildata.current_u || 0}A</span>
                        <span class="info-label">${details.power_a}</span>
                        <span class="info-value">${detaildata.power_u || 0}W</span>
                    </div>
                    <div class="info-grid">
                        <span class="info-label">${details.volt_b}</span>
                        <span class="info-value">${detaildata.voltage_v || 0}V</span>
                        <span class="info-label">${details.curr_b}</span>
                        <span class="info-value">${detaildata.current_v || 0}A</span>
                        <span class="info-label">${details.power_b}</span>
                        <span class="info-value">${detaildata.power_v || 0}W</span>
                    </div>
                    <div class="info-grid">
                        <span class="info-label">${details.volt_c}</span>
                        <span class="info-value">${detaildata.voltage_w || 0}V</span>
                        <span class="info-label">${details.curr_c}</span>
                        <span class="info-value">${detaildata.current_w || 0}A</span>
                        <span class="info-label">${details.power_c}</span>
                        <span class="info-value">${detaildata.power_w || 0}W</span>
                    </div>
                    ` : ``}

                <div class="info-title">Bypass</div>
                ${device.inverter_model === 'mr' ? `
                    <div class="info-item">
                        <span class="info-label">${details.volt}</span>
                        <span class="info-value">${detaildata.bypass.voltage_v || 0}V</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">${details.current}</span>
                        <span class="info-value">${detaildata.bypass.current_v || 0}A</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">${details.power}</span>
                        <span class="info-value">${detaildata.bypass.power_v || 0}W</span>
                    </div>
                    ` : ``}
                ${device.inverter_model === 'tq' || device.inverter_model === 'uhc-3-hv'? `
                    <div class="info-grid">
                        <span class="info-label">${details.volt_a}</span>
                        <span class="info-value">${detaildata.bypass.voltage_u || 0}V</span>
                        <span class="info-label">${details.curr_a}</span>
                        <span class="info-value">${detaildata.bypass.current_u || 0}A</span>
                        <span class="info-label">${details.power_a}</span>
                        <span class="info-value">${detaildata.bypass.power_u || 0}W</span>
                    </div>
                    <div class="info-grid">
                        <span class="info-label">${details.volt_b}</span>
                        <span class="info-value">${detaildata.bypass.voltage_v || 0}V</span>
                        <span class="info-label">${details.curr_b}</span>
                        <span class="info-value">${detaildata.bypass.current_v || 0}A</span>
                        <span class="info-label">${details.power_b}</span>
                        <span class="info-value">${detaildata.bypass.power_v || 0}W</span>
                    </div>
                    <div class="info-grid">
                        <span class="info-label">${details.volt_c}</span>
                        <span class="info-value">${detaildata.bypass.voltage_w || 0}V</span>
                        <span class="info-label">${details.curr_c}</span>
                        <span class="info-value">${detaildata.bypass.current_w || 0}A</span>
                        <span class="info-label">${details.power_c}</span>
                        <span class="info-value">${detaildata.bypass.power_w || 0}W</span>
                    </div>
                    ` : ``}

            </div>
        `;
    },

    renderGridDetails(details, detaildata, device) {
        if (!detaildata) {
            return `<div class="no-data">${details.no_detail_data}</div>`;
        }

        return `
            <div class="info-list">
                <div class="info-title">Grid</div>
                ${device.inverter_model === 'mr' ? `
                    <div class="info-item">
                        <span class="info-label">${details.volt}</span>
                        <span class="info-value">${detaildata.voltage_v || 0}V</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">${details.current}</span>
                        <span class="info-value">${detaildata.current_v || 0}A</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">${details.power}</span>
                        <span class="info-value">${detaildata.power_v || 0}W</span>
                    </div>
                    ` : ``}
                ${device.inverter_model === 'tq' || device.inverter_model === 'uhc-3-hv' ? `
                    <div class="info-grid">
                        <span class="info-label">${details.volt_a}</span>
                        <span class="info-value">${detaildata.voltage_u || 0}V</span>
                        <span class="info-label">${details.curr_a}</span>
                        <span class="info-value">${detaildata.current_u || 0}A</span>
                        <span class="info-label">${details.power_a}</span>
                        <span class="info-value">${detaildata.power_u || 0}W</span>
                    </div>
                    <div class="info-grid">
                        <span class="info-label">${details.volt_b}</span>
                        <span class="info-value">${detaildata.voltage_v || 0}V</span>
                        <span class="info-label">${details.curr_b}</span>
                        <span class="info-value">${detaildata.current_v || 0}A</span>
                        <span class="info-label">${details.power_b}</span>
                        <span class="info-value">${detaildata.power_v || 0}W</span>
                    </div>
                    <div class="info-grid">
                        <span class="info-label">${details.volt_c}</span>
                        <span class="info-value">${detaildata.voltage_w || 0}V</span>
                        <span class="info-label">${details.curr_c}</span>
                        <span class="info-value">${detaildata.current_w || 0}A</span>
                        <span class="info-label">${details.power_c}</span>
                        <span class="info-value">${detaildata.power_w || 0}W</span>
                    </div>
                    ` : ``}

                <div class="info-item">
                    <span class="info-label">${details.frequency}</span>
                    <span class="info-value">${detaildata.frequency || 0}Hz</span>
                </div>
            </div>
        `;
    },

    //渲染设备详情页
    renderDevInfoPage(translations, loading, error, device, data) {
        if (loading) {
            return `<div class="loading">${translations.loading}...</div>`;
        }
        if (error) {
            return `<div class="error">${error}</div>`;
        }
        if (!device || !data) {
            return `<div class="no-data">${translations.no_dev_data}</div>`;
        }

        return `
            <div class="energy-main-page">
                <div class="info-list">
                    <div class="info-item">
                        <span class="info-label">${translations.dev_name}</span>
                        <span class="info-value">${data.name || ''}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">${translations.sn}</span>
                        <span class="info-value">${data.sn || ''}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">${translations.timezone}</span>
                        <span class="info-value">${data.timezone_name || ''}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">${translations.pcs_model}</span>
                        <span class="info-value">${data.pcsmodel || ''}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">${translations.Firmware}</span>
                        <span class="info-value">${data.firmware || ''}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">${translations.pcs_software}</span>
                        <span class="info-value">${data.pcs_soft_ver || ''}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">${translations.bms_software}</span>
                        <span class="info-value">${data.bms_soft_ver || ''}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">${translations.IP_address}</span>
                        <span class="info-value">${data.ip_address || ''}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">${translations.arm_software}</span>
                        <span class="info-value">${data.arm_soft_ver || ''}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">${translations.os_ver}</span>
                        <span class="info-value">${data.os_ver || ''}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">${translations.wifi_name}</span>
                        <span class="info-value">${data.wifiname || ''}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">${translations.dev_sn}</span>
                        <span class="info-value">${data.devsn || ''}</span>
                    </div>
                </div>
            </div>

        `;
    },

    renderDevAlarmsPage(translations, loading, error, device, data) {
        console.log('data:', data);
        if (loading) {
            return `<div class="loading">${translations.loading}...</div>`;
        }
        if (error) {
            return `<div class="error">${error}</div>`;
        }
        if (!device || !data || !Array.isArray(data) || data.length === 0) {
            return `<div class="no-data">${translations.no_alarm_data}</div>`;
        }

        return `
            ${data
                // 第一步：过滤数据，只保留 level 为 1 (告警) 或 2 (故障) 的项
                .filter(event => event.level === 1 || event.level === 2)
                .map(event => `
                    <div class="event-card">
                        <!--
                            根据 level 值判断显示告警样式还是故障样式
                            level 1: 告警 (event-alarm)
                            level 2: 故障 (event-err)
                        -->
                        ${event.level === 1 ?
                            `<div class="event-alarm">[${event.event_no || '---'} ${event.event_name || '---'}]</div>` :
                            `<div class="event-error">[${event.event_no || '---'} ${event.event_name || '---'}]</div>`
                        }
                        <div class="event-item">${translations.time}: ${event.time_str || '---'}</div>
                        <div class="event-item">${translations.dev}: ${event.source || '---'}#${event.source_id || '---'}</div>
                        <div class="event-item">${translations.alarm_state}: ${event.level === 1 ? translations.state_alarm : translations.state_error}</div>

                        <div class="event-item">${translations.description}: ${event.correlation || '0'}</div>
                        <div class="event-item">${translations.advices}: ${event.advice || '---'}</div>

                    </div>
                `).join('')}
        `;
    },

};