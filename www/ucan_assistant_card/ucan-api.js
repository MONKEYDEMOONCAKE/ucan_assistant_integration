export class UcanApi {
    constructor(hass) {
        this._hass = hass; // 保存HA的hass实例（含认证）
    }

    // GET：获取设备列表
    async getDeviceList() {
        try {
            const response = await this._hass.fetchWithAuth('/api/ucan_assistant/device_list', {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            // 适配返回格式（数组/嵌套list）
            return Array.isArray(data) ? data : (data.list || []);
        } catch (error) {
                console.error('获取设备列表失败:', error);
                throw error;
        }
    }

    // POST：选择设备（通知后端SN/ID）
    async selectDevice(device) {
        try {
            const response = await this._hass.fetchWithAuth('/api/ucan_assistant/device_status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    device_sn: device.device_sn,
                    device_id: device.device_id
                })
            });

            const result = await response.json();
            if (!response.ok || !result.success) {
                throw new Error(result.message || '选择设备失败');
            }
            return result;
        } catch (error) {
            console.error('选择设备失败:', error);
            throw error;
        }
    }

    // GET：获取设备功率数据
    async getDevicePower() {
        try {
            const response = await this._hass.fetchWithAuth('/api/ucan_assistant/device_status', {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            if (!data.success) throw new Error(data.message || '获取功率数据失败');

            // 提取功率数据（适配后端返回字段）
            return {
                grid: data.status.grid_power || 0,
                load: data.status.load_power || 0,
                solar: data.status.solar_power || 0,
                battery: data.status.battery_power || 0,
                usage_solar_today: data.status.usage_solar_today / 1000 || 0,
                usage_solar_total: data.status.usage_solar_total / 1000 || 0,
                usage_battery_today: data.status.usage_battery_discharge_today / 1000 || 0,
                usage_battery_total: data.status.usage_battery_discharge_total / 1000 || 0,
                usage_grid_today: data.status.usage_grid_today / 1000 || 0,
                usage_grid_total: data.status.usage_grid_total / 1000 || 0,
                usage_load_today: data.status.usage_load_today / 1000 || 0,
                usage_load_total: data.status.usage_load_total / 1000 || 0,
            };
        } catch (error) {
            console.error('获取功率数据失败:', error);
            throw error;
        }
    }

    generateStandardTimeline(intervalMinutes = 5) {
        const timeline = [];
        for (let hour = 0; hour < 24; hour++) {
            for (let minute = 0; minute < 60; minute += intervalMinutes) {
                const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
                timeline.push(timeStr);
            }
        }
        return timeline;
    }

    //使用原始数据最近有效值
    alignDataToTimeline(rawData, standardTimeline) {
        // 1. 提取有效数据点，并解析时间（只保留 HH:MM）
        const validDataPoints = [];
        rawData.timeline.forEach((timeStr, index) => {
            const value = rawData.values[index];
            // 只保留有效数值
            if (value !== null && value !== undefined && !isNaN(value)) {
                const hm = timeStr.substring(0, 5);
                validDataPoints.push({ timeline: hm, value });
            }
        });
        //console.log("有效数值：", validDataPoints);
        // 如果没有有效数据，直接返回全 null
        if (validDataPoints.length === 0) {
            return {
                timeline: standardTimeline,
                values: standardTimeline.map(() => null)
            };
        }

        // 2. 找出历史数据中最后的时间点（用于判断未来）
        const lastRawTimeStr = rawData.timeline[rawData.timeline.length - 1];
        const lastRawHM = lastRawTimeStr.substring(0, 5);

        // 3. 辅助函数：计算两个时间点之间相差多少分钟
        function getTimeDiffInSlots(t1, t2) {
            const [h1, m1] = t1.split(':').map(Number);
            const [h2, m2] = t2.split(':').map(Number);
            const minutes1 = h1 * 60 + m1;
            const minutes2 = h2 * 60 + m2;
            return Math.round(minutes2 - minutes1);
        }

        // 4. 辅助函数：找到在 targetTime 之前最近的有效数据点
        function findNearestValidValue(targetTime) {
            // 从后往前找，找到第一个时间 <= targetTime 的有效点
            for (let i = validDataPoints.length - 1; i >= 0; i--) {
                const { timeline, value } = validDataPoints[i];
                //console.log("validDataPoints:", validDataPoints[i])
                if (timeline <= targetTime) {
                    return { value, timeline, diff: getTimeDiffInSlots(timeline, targetTime) };
                }
            }
            return null; // 没找到
        }

        // 5. 遍历标准时间轴
        const alignedValues = [];

        for (const timePoint of standardTimeline) {
            // 规则：禁止未来数据
            if (timePoint > lastRawHM) {
                alignedValues.push(null);
                continue;
            }

            // 检查原始数据中是否有这个时间点的值
            const rawIndex = rawData.timeline.findIndex(t => t.substring(0, 5) === timePoint);
            if (rawIndex !== -1) {
                const val = rawData.values[rawIndex];
                alignedValues.push(val);
            } else {
                // 没有直接数据，尝试找最近的有效原始数据

                const nearest = findNearestValidValue(timePoint);
                if (nearest && nearest.diff <= 10 && nearest.diff > 0) {
                    // 距离在10分钟内
                    alignedValues.push(nearest.value);
                } else {
                    alignedValues.push(0);
                }

            }
        }

        return {
            timeline: standardTimeline,
            values: alignedValues
        };
    }

    // alignDataToTimeline(rawData, standardTimeline) {
    //     // 1. 构建数据映射
    //     const dataMap = new Map();
    //     rawData.timeline.forEach((timeStr, index) => {
    //         const hm = timeStr.substring(0, 5);
    //         dataMap.set(hm, rawData.values[index]);
    //     });

    //     // 2. 找出原始数据中的"最新时间点"
    //     if (rawData.timeline.length === 0) {
    //         return {
    //             timeline: standardTimeline,
    //             values: standardTimeline.map(() => null)
    //         };
    //     }

    //     const lastRawTimeStr = rawData.timeline[rawData.timeline.length - 1];
    //     const lastRawHM = lastRawTimeStr.substring(0, 5);

    //     // 3. 遍历标准时间轴
    //     const alignedValues = [];

    //     // 状态变量
    //     let lastNonZeroValue = null; // 上一个有效的值
    //     let consecutiveFillCount = 0; // 连续填充计数器 (用于计算0值填充)

    //     for (const timePoint of standardTimeline) {

    //         // --- 规则 1：绝对禁止未来数据 ---
    //         if (timePoint > lastRawHM) {
    //             alignedValues.push(null);
    //             // 注意：遇到未来时间，不重置计数器，但通常循环到这里也结束了
    //             continue;
    //         }

    //         if (dataMap.has(timePoint)) {
    //             // --- 规则 2：有真实数据 ---
    //             const val = dataMap.get(timePoint);
    //             alignedValues.push(val);

    //             // 重置填充计数器，因为遇到了真实数据
    //             consecutiveFillCount = 0;

    //             // 更新 lastNonZeroValue (有效数值才更新)
    //             if (val !== null && val !== undefined && !isNaN(val)) {
    //                 lastNonZeroValue = val;
    //             }
    //             // 如果 val 是 无效值，我们保留 lastNonZeroValue 不变

    //         } else {
    //             // --- 规则 3：无真实数据，但在有效时间范围内 ---

    //             // 检查连续填充计数
    //             if (consecutiveFillCount < 3 && lastNonZeroValue !== null) {
    //                 // 允许填充：连续填充次数小于3，且有可用的非零值
    //                 alignedValues.push(lastNonZeroValue);
    //                 consecutiveFillCount++; // 计数器+1
    //             } else {
    //                 // 禁止填充：已经超过3个连续点，或者前面根本没有有效值
    //                 alignedValues.push(0);
    //             }
    //         }
    //     }

    //     return {
    //         timeline: standardTimeline,
    //         values: alignedValues
    //     };
    // }

    _getDayTimeRange(targetDate, deviceOffsetSecs) {

        // 1. 处理输入日期，兼容不传参（默认当前日期）、字符串、Date对象
        let date;
        if (!targetDate) {
            date = new Date(); // 不传参默认当前日期
        } else if (typeof targetDate === 'string') {
            date = new Date(targetDate); // 字符串转Date对象（支持"2026-01-09"等格式）
        } else if (targetDate instanceof Date) {
            date = new Date(targetDate); // 直接使用传入的Date对象（避免修改原对象）
        } else {
            throw new Error('传入的日期格式无效，请传入Date对象或可解析的日期字符串');
        }
        console.log("date:", date);

        // 强制将 "传入的日期" 视为 "设备本地日期"
        const year = date.getFullYear();
        const month = date.getMonth();
        const day = date.getDate();

        //构造本地时间对象
        const deviceLocalStart = new Date(year, month, day); // 时分秒默认为0
        const deviceLocalEnd = new Date(year, month, day, 23, 59, 59, 999);

        const timeOffsetMs = deviceOffsetSecs * 1000; // 设备偏移（毫秒）
        const localOffsetMs = date.getTimezoneOffset() * 60 * 1000; //HA偏移
        // 计算设备时间对应的UTC时间范围
        const utcStart = new Date(deviceLocalStart.getTime() - timeOffsetMs - localOffsetMs);
        const utcEnd = new Date(deviceLocalEnd.getTime() - timeOffsetMs - localOffsetMs);
        // 5. 转换为HA API要求的ISO格式字符串（如2026-01-09T00:00:00.000Z）
        return {
            startOfDayISO: utcStart.toISOString(),
            endOfDayISO: utcEnd.toISOString()
        };
    }

    async getAllPowerHistoryData(device, targetDate, deviceOffsetSecs) {

        const standardTimeline = this.generateStandardTimeline(5); // 每5分钟一个点

        // 定义需要获取的数据类型列表
        const types = [
            { key: 'grid', label: 'Grid' },
            { key: 'solar', label: 'Solar' },
            { key: 'battery', label: 'Battery' },
            { key: 'load', label: 'Load' }
        ];

        // 2. 并行获取所有数据 (优化加载速度)
        const fetchPromises = types.map(async ({ key, label }) => {
            try {
                const rawData = await this.getPowerHistoryData(key, device, targetDate, deviceOffsetSecs);

                // 关键步骤：将每个传感器的数据对齐到标准时间轴
                // 如果历史记录中没有数据，rawData.timeline 会是空的，align 函数会返回全 0 数组
                const alignedData = this.alignDataToTimeline(rawData, standardTimeline);

                return {
                    label: label,
                    timeline: alignedData.timeline,
                    values: alignedData.values
                };
            } catch (error) {
                console.warn(`${label} 数据获取失败，使用全零填充`);
                console.warn(`${label} 失败详情:`, error.message);
                // 如果获取失败，返回一个全零的数组以保持图表结构
                return {
                    label: label,
                    timeline: standardTimeline,
                    values: new Array(standardTimeline.length).fill(0)
                };
            }
        });

        // 等待所有数据获取并处理完成
        const resolvedData = await Promise.all(fetchPromises);

        // 过滤掉可能的错误项（虽然上面有 try-catch，但为了严谨）
        return resolvedData.filter(data => data !== null);
    }

    async getPowerHistoryData(powerType, device, targetDate, deviceOffsetSecs) {
        try {
            // const startTime = this._get24HoursAgoTime();
            const { startOfDayISO, endOfDayISO } = this._getDayTimeRange(targetDate, deviceOffsetSecs)
            //console.log(`查询数据，时间范围(HA库):`, startOfDayISO, '到', endOfDayISO);
            const historyRes = await this._hass.fetchWithAuth(
                `/api/history/period/${startOfDayISO}?end_time=${endOfDayISO}&filter_entity_id=sensor.${device.device_sn}_${powerType}_power&minimal_response=true`
            );
            const historyRaw = await historyRes.json();

            // 解析HA返回的历史数据（转换为Chart.js需要的格式）
            const historyData = historyRaw[0] || []; // HA返回的是二维数组，取第一个元素
            const result = {
                timeline: [],
                values: []
            };

            // 遍历历史数据，提取时间和数值（可选：按小时采样，避免数据点过多）
            historyData.forEach(item => {
                const value = Number(item.state);
                if (isNaN(value)) return;

                // 关键：这里的时间是HA数据库里的时间（ISO格式）
                const HaTime = new Date(item.last_changed);

                // 1. 转换为设备本地时间
                // HA时间 + 设备偏移 = 设备本地时间
                const localOffsetMs = HaTime.getTimezoneOffset() * 60 * 1000; //HA偏移
                const deviceTime = new Date(HaTime.getTime() + localOffsetMs + deviceOffsetSecs * 1000);

                // 2. 格式化为 HH:mm (这是设备本地的时间，也就是你想在X轴显示的时间)
                const timeStr = deviceTime.toTimeString().slice(0, 5); // "HH:mm"
                result.timeline.push(timeStr);
                result.values.push(value);
            });
            console.log('result:', result);
            return result;
        } catch (error) {
            console.error('拉取功率数据失败:', error);
            throw error;
        }
    }

    //GET: 获取详细数据
    async getDetailsData() {
        try {
            const response = await this._hass.fetchWithAuth('/api/ucan_assistant/device_details', {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            if (!data.success) throw new Error(data.message || '获取详细数据失败');

            const result = {
                bat: data.details.battery || [],
                mppt: data.details.pv || {},
                load: data.details.load || {},
                grid: data.details.grid || {},
            };
            return result || {};
        } catch (error) {
            console.error('获取设备详细信息失败:', error);
            throw error;
        }
    }

    //GET: 获取告警数据
    async getAlarmData() {
        try {
            const response = await this._hass.fetchWithAuth('/api/ucan_assistant/device_alarms', {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            if (!data.success) throw new Error(data.message || '获取告警数据失败');

            return data.alarms || [];
        } catch (error) {
            console.error('获取告警数据失败:', error);
            throw error;
        }
    }

    //GET: 获取设备信息
    async getDevInfoData() {
        try {
            const response = await this._hass.fetchWithAuth('/api/ucan_assistant/device_info', {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            if (!data.success) throw new Error(data.message || '获取设备信息失败');

            // 提取设备信息（适配后端返回字段）
            return {
                name: data.info.device_name || '---',
                model: data.info.model || '---',
                firmware: data.info.firmware || '---',
                pcs_soft_ver: data.info.pcs_soft_ver || '---',
                bms_soft_ver: data.info.battery_software || '---',
                arm_soft_ver: data.info.arm_soft_ver || '---',
                ip_address: data.info.ip_address || '---',
                os_ver: data.info.os_ver || '---',
                sn: data.info.device_sn || '---',
                timezone: data.info.timezone || '---',
                timezone_name: data.info.timezone_name || '---',
                pcsmodel: data.info.pcs_model || '---',
                devsn: data.info.dev_sn || '---',
                wifiname: data.info.wifi_name || '---'
            };
        } catch (error) {
            console.error('获取设备信息失败:', error);
            throw error;
        }
    }


    // 启动单例轮询（返回定时器ID）
    startPolling(callback, interval = 5000, oldIntervalId) {

        // 清除旧的轮询
        if (oldIntervalId) {
            clearInterval(oldIntervalId);
        }

        // 立即执行一次
        callback();

        // 定时轮询
        return setInterval(() => callback(), interval);
    }
};