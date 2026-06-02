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
            if (!data.success) throw new Error(data.message || '获取主页功率数据失败');

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
            console.error('获取主页功率数据失败:', error);
            throw error;
        }
    }


    // POST：选择统计时间段
    async selectTimeRange(device, start_time, end_time, data_type="") {
        try {
            const response = await this._hass.fetchWithAuth('/api/ucan_assistant/device_power', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    device_id: device.device_id,
                    start_time: start_time,
                    end_time: end_time,
                    data_type: data_type
                })
            });

            const result = await response.json();
            if (!response.ok || !result.success) {
                throw new Error(result.message || '选择时段失败');
            }
            return result;
        } catch (error) {
            console.error('选择时段失败:', error);
            throw error;
        }
    }

    //GET 获取统计数据
    async getPowerData() {
        try {
            const response = await this._hass.fetchWithAuth('/api/ucan_assistant/device_power', {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            if (!data.success) throw new Error(data.message || '获取功率统计数据失败');

            // 提取功率数据（适配后端返回字段）
            return data.power || {};
        } catch (error) {
            console.error('获取功率统计数据失败:', error);
            throw error;
        }
    }

    generateStandardTimeline_day(intervalMinutes = 5) {
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
    alignDataToTimeline_day(rawData, standardTimeline) {
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

    async selectDataTimeRange(device, targetDate, deviceOffsetSecs, chart_type) {
        // 1. 获取当日时间戳
        // 2. 获取所有历史数据
        let { startOfDay, endOfDay } = {};
        let result = null;
        if (chart_type == "day") {
            ({ startOfDay, endOfDay } = this._getDayTimeRange(targetDate, deviceOffsetSecs));   //加括号判定为表达式，实现解构赋值
            result = await this.selectTimeRange(device, startOfDay, endOfDay, "");
        }

        else if (chart_type == "month") {
            ({ startOfDay, endOfDay } = this._getMonthTimeRange(targetDate, deviceOffsetSecs));
            result = await this.selectTimeRange(device, startOfDay, endOfDay, "day");
        }

        else if(chart_type == "year"){
            ({ startOfDay, endOfDay } = this._getYearTimeRange(targetDate, deviceOffsetSecs));
            result = await this.selectTimeRange(device, startOfDay, endOfDay, "month");
        }
        else if(chart_type == "total"){
            ({ startOfDay, endOfDay } = this._getTotalTimeRange(deviceOffsetSecs));
            result = await this.selectTimeRange(device, startOfDay, endOfDay, "year");
        }

        if (result.success !== true) {
            console.error("设置功率统计时间段失败:", result.message);
            return false; // 失败时返回空数组
        }
        else
            return true;

    }

    //返回秒级时间戳

    //获取日数据起止时间
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

        // 获取年月日找到当天零时时间戳
        const year = date.getFullYear();
        const month = date.getMonth();
        const day = date.getDate();

        // 计算设备时间对应的UTC时间范围
        const utcStart = Date.UTC(year, month, day) - deviceOffsetSecs * 1000;
        const utcEnd = utcStart + 24 * 60 * 60 * 1000 - 1;
        return {
            startOfDay: Math.floor(utcStart / 1000),
            endOfDay: Math.floor(utcEnd / 1000)
        };
    }

    //获取月数据起止时间
    _getMonthTimeRange(targetDate, deviceOffsetSecs) {

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

        // 获取年月日找到当天零时时间戳
        const year = date.getFullYear();
        const month = date.getMonth();
        // 计算设备时间对应的UTC时间范围
        const utcStart = Date.UTC(year, month, 1) - deviceOffsetSecs * 1000;  //当月1号
        const utcEnd = Date.UTC(year, month + 1, 1) - deviceOffsetSecs * 1000 - 1;  //当月最后一天
        return {
            startOfDay: Math.floor(utcStart / 1000),
            endOfDay: Math.floor(utcEnd / 1000)
        };
    }

    //获取年数据起止时间
    _getYearTimeRange(targetDate, deviceOffsetSecs) {

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

        // 获取年月日找到当天零时时间戳
        const year = date.getFullYear();

        // 计算设备时间对应的UTC时间范围
        const utcStart = Date.UTC(year, 0, 1) - deviceOffsetSecs * 1000;  //当前年1.1
        const utcEnd = Date.UTC(year + 1, 0, 1) - deviceOffsetSecs * 1000 - 1;  //下一年1.1 - 1
        return {
            startOfDay: Math.floor(utcStart / 1000),
            endOfDay: Math.floor(utcEnd / 1000)
        };
    }

    //获取总数据起止时间
    _getTotalTimeRange(deviceOffsetSecs) {

        // 获取年月日找到当天零时时间戳
        let date = new Date();
        const year = date.getFullYear();
        const month = date.getMonth();
        const day = date.getDate();

        // 计算设备时间对应的UTC时间范围
        const utcStart = Date.UTC(2020, 0, 1);  //2020年1.1   假设没有20年前的设备
        const utcEnd = Date.UTC(year, month, day) - deviceOffsetSecs * 1000 + 24 * 60 * 60 * 1000 - 1;  //截至今日最后时刻
        return {
            startOfDay: Math.floor(utcStart / 1000),
            endOfDay: Math.floor(utcEnd / 1000)
        };
    }



    async getHistoryData_day(deviceOffsetSecs) {

        const standardTimeline = this.generateStandardTimeline_day(5); // 每5分钟一个点

        // 0. 定义需要获取的数据类型列表
        const types = [
            { key: 'grid', label: 'Grid' },
            { key: 'solar', label: 'Solar' },
            { key: 'battery', label: 'Battery' },
            { key: 'load', label: 'Load' },
        ];

        // 1. 获取功率数据的原始响应
		const result = await this.getPowerData();

        // 2. 并行处理所有数据 (优化加载速度)
        const fetchPromises = types.map(async ({ key, label }) => {
            try {
                const rawData = await this.handleHistoryData_day(key, result, deviceOffsetSecs);
                // console.log(`raw ${key} data:`, rawData);

                // 关键步骤：将每个传感器的数据对齐到标准时间轴
                // 如果历史记录中没有数据，rawData.timeline 会是空的，align 函数会返回全 0 数组
                const alignedData = this.alignDataToTimeline_day(rawData, standardTimeline);
                return {
                    label: label,
                    timeline: alignedData.timeline,
                    values: alignedData.values,
                    isFilled: false
                };
            } catch (error) {
                console.warn(`${label} 数据获取失败，使用全零填充`);
                console.warn(`${label} 失败详情:`, error.message);
                // 如果获取失败，返回一个全零的数组以保持图表结构
                return {
                    label: label,
                    timeline: standardTimeline,
                    values: new Array(standardTimeline.length).fill(0),
                    isFilled: true
                };
            }
        });

        // 等待所有数据获取并处理完成
        const resolvedData = await Promise.all(fetchPromises);
        const validData = resolvedData.filter(data => data !== null);

        //检查是否存在填充数据
        const hasFilledData = validData.some(data => data.isFilled);
        console.log("hasFilledData:", hasFilledData);
        // 过滤掉可能的错误项（虽然上面有 try-catch，但为了严谨）
        return {
            filled:hasFilledData,
            data: validData
        };
    }

    async handleHistoryData_day(powerType, respond, deviceOffsetSecs) {
        try {
            // console.log("respond:", respond);
            // 提取对应类型的历史数据
            const historyRaw = respond["serial"][powerType] || [];
            const timelineRaw = respond["serial"]["add_time"] || [];
            // console.log(`raw ${powerType} data:`, historyRaw);
            // console.log(`raw timeline data:`, timelineRaw);

            // 解析HA返回的历史数据（转换为Chart.js需要的格式）
            const result = {
                timeline: [],
                values: []
            };

            // 遍历时间轴，存储索引获取对应数值
            let index = 0;
            timelineRaw.forEach(time => {
                const value = historyRaw[index] || 0;
                if (isNaN(value)) return;

                index += 1;
                // 获取系统时间偏差
                let date = new Date();
                const HaOffsetMs = date.getTimezoneOffset() * 60 * 1000; //HA偏移
                let deviceTime = time * 1000 + deviceOffsetSecs * 1000 + HaOffsetMs;
                let deviceDate = new Date(deviceTime);
                // 2. 格式化为 HH:mm (这是设备本地的时间，也就是你想在X轴显示的时间)
                const timeStr = deviceDate.toTimeString().slice(0, 5); // "HH:mm"
                result.timeline.push(timeStr);
                result.values.push(value);
            });
            // console.log('result:', result);
            return result;
        } catch (error) {
            console.error('拉取日功率数据失败:', error);
            throw error;
        }
    }

    async getHistoryData_month(deviceOffsetSecs) {

        // 0. 定义需要获取的数据类型列表
        const types = [
            { key: 'grid', label: 'Grid' },
            { key: 'solar', label: 'Solar' },
            { key: 'battery', label: 'Battery' },
            { key: 'load', label: 'Load' },
        ];

        // 1. 获取功率数据的原始响应
        const result = await this.getPowerData();
        console.log("result:", result);

        // 2. 并行处理所有数据 (优化加载速度)
        const fetchPromises = types.map(async ({ key, label }) => {
            try {
                //处理数据，缺失补零
                const alignedData = await this.handleHistoryData_month(key, result, deviceOffsetSecs);
                console.log(`alignedData ${key} data:`, alignedData);
                return {
                    label: label,
                    timeline: alignedData.timeline,
                    values: alignedData.values,
                    isFilled: false
                };
            } catch (error) {
                console.warn(`${label} 数据获取失败，使用全零填充`);
                console.warn(`${label} 失败详情:`, error.message);
                // 如果获取失败，返回一个全零的数组以保持图表结构
                return {
                    label: label,
                    timeline: Array.from({ length: 31 }, (_, i) => i + 1),
                    values: new Array(12).fill(0),
                    isFilled: true
                };
            }
        });

        // 等待所有数据获取并处理完成
        const resolvedData = await Promise.all(fetchPromises);
        const validData = resolvedData.filter(data => data !== null);

        //检查是否存在填充数据
        const hasFilledData = validData.some(data => data.isFilled);
        console.log("hasFilledData:", hasFilledData);
        // 过滤掉可能的错误项（虽然上面有 try-catch，但为了严谨）
        return {
            filled:hasFilledData,
            data: validData
        };
    }

    async handleHistoryData_month(powerType, respond, deviceOffsetSecs) {
        try {
            // console.log("respond:", respond);
            // 提取对应类型的历史数据
            const historyRaw = respond["serial"][powerType] || [];
            const timelineRaw = respond["serial"]["add_time"] || [];
            console.log(`raw ${powerType} data:`, historyRaw);
            console.log(`raw timeline data:`, timelineRaw);


            if (!timelineRaw || timelineRaw.length === 0) {
                throw new Error('No data available'); // 抛出错误，触发 catch
            }

            const dayMap = {};        //存储原始缺失数据

            let day_cnt = 0;
            // 遍历时间轴，存储索引获取对应数值
            let index = 0;
            timelineRaw.forEach(time => {
                const value = historyRaw[index] / 1000 || 0;
                if (isNaN(value)) return;

                index += 1;
                // 获取系统时间偏差
                let date = new Date();
                const HaOffsetMs = date.getTimezoneOffset() * 60 * 1000; //HA偏移
                // console.log("deviceOffsetSecs:", deviceOffsetSecs);
                let deviceTime = time * 1000 + HaOffsetMs + deviceOffsetSecs * 1000;
                // console.log("deviceTime:", deviceTime);
                let deviceDate = new Date(deviceTime);
                // 2. 格式化为月数(这是设备本地的时间，也就是你想在X轴显示的时间)
                const day = deviceDate.getDate(); // "1-31"
                day_cnt = new Date(deviceDate.getFullYear(), deviceDate.getMonth() + 1, 0).getDate();
                dayMap[day] = value;
            });
            const result = {
                timeline: [],
                values: []
            };
            for (let day = 1; day <= day_cnt; day++) {
                result.timeline.push(day);
                result.values.push(dayMap[day] || 0);
            }
            // console.log('result:', result);
            return result;
        } catch (error) {
            console.error('拉取处理月数据失败:', error);
            throw error;
        }
    }

    async getHistoryData_year(deviceOffsetSecs) {

        // 0. 定义需要获取的数据类型列表
        const types = [
            { key: 'grid', label: 'Grid' },
            { key: 'solar', label: 'Solar' },
            { key: 'battery', label: 'Battery' },
            { key: 'load', label: 'Load' },
        ];

        // 1. 获取功率数据的原始响应
		const result = await this.getPowerData();

        // 2. 并行处理所有数据 (优化加载速度)
        const fetchPromises = types.map(async ({ key, label }) => {
            try {
                //处理数据，缺失补零
                const alignedData = await this.handleHistoryData_year(key, result, deviceOffsetSecs);
                console.log(`alignedData ${key} data:`, alignedData);
                return {
                    label: label,
                    timeline: alignedData.timeline,
                    values: alignedData.values,
                    isFilled: false
                };
            } catch (error) {
                console.warn(`${label} 数据获取失败，使用全零填充`);
                console.warn(`${label} 失败详情:`, error.message);
                // 如果获取失败，返回一个全零的数组以保持图表结构
                return {
                    label: label,
                    timeline: Array.from({ length: 12 }, (_, i) => i + 1),
                    values: new Array(12).fill(0),
                    isFilled: true
                };
            }
        });

        // 等待所有数据获取并处理完成
        const resolvedData = await Promise.all(fetchPromises);
        const validData = resolvedData.filter(data => data !== null);

        //检查是否存在填充数据
        const hasFilledData = validData.some(data => data.isFilled);
        console.log("hasFilledData:", hasFilledData);
        // 过滤掉可能的错误项（虽然上面有 try-catch，但为了严谨）
        return {
            filled:hasFilledData,
            data: validData
        };
    }

    async handleHistoryData_year(powerType, respond, deviceOffsetSecs) {
        try {
            // console.log("respond:", respond);
            // 提取对应类型的历史数据
            const historyRaw = respond["serial"][powerType] || [];
            const timelineRaw = respond["serial"]["add_time"] || [];
            // console.log(`raw ${powerType} data:`, historyRaw);
            // console.log(`raw timeline data:`, timelineRaw);


            if (!timelineRaw || timelineRaw.length === 0) {
                throw new Error('No data available'); // 抛出错误，触发 catch
            }

            const monthMap = {};        //存储原始缺失数据


            // 遍历时间轴，存储索引获取对应数值
            let index = 0;
            timelineRaw.forEach(time => {
                const value = historyRaw[index] / 1000 || 0;
                if (isNaN(value)) return;

                index += 1;
                // 获取系统时间偏差
                let date = new Date();
                const HaOffsetMs = date.getTimezoneOffset() * 60 * 1000; //HA偏移
                // console.log("deviceOffsetSecs:", deviceOffsetSecs);
                let deviceTime = time * 1000 + HaOffsetMs + deviceOffsetSecs * 1000;
                // console.log("deviceTime:", deviceTime);
                let deviceDate = new Date(deviceTime);
                // 2. 格式化为月数(这是设备本地的时间，也就是你想在X轴显示的时间)
                const month = deviceDate.getMonth() + 1; // "1-12"
                monthMap[month] = value;
            });
            const result = {
                timeline: [],
                values: []
            };
            for (let month = 1; month <= 12; month++) {
                result.timeline.push(month);
                result.values.push(monthMap[month] || 0);
            }
            // console.log('result:', result);
            return result;
        } catch (error) {
            console.error('拉取处理月数据失败:', error);
            throw error;
        }
    }

    async getHistoryData_total(deviceOffsetSecs) {

        // 0. 定义需要获取的数据类型列表
        const types = [
            { key: 'grid', label: 'Grid' },
            { key: 'solar', label: 'Solar' },
            { key: 'battery', label: 'Battery' },
            { key: 'load', label: 'Load' },
        ];

        // 1. 获取功率数据的原始响应
		const result = await this.getPowerData();

        // 2. 并行处理所有数据 (优化加载速度)
        const fetchPromises = types.map(async ({ key, label }) => {
            try {
                //处理数据，缺失补零
                const alignedData = await this.handleHistoryData_total(key, result, deviceOffsetSecs);
                console.log(`alignedData ${key} data:`, alignedData);
                return {
                    label: label,
                    timeline: alignedData.timeline,
                    values: alignedData.values,
                    isFilled: false
                };
            } catch (error) {
                console.warn(`${label} 数据获取失败，使用全零填充`);
                console.warn(`${label} 失败详情:`, error.message);
                // 如果获取失败，返回一个全零的数组以保持图表结构
                let now = new Date();
                const HaOffsetMs = now.getTimezoneOffset() * 60 * 1000;
                const deviceNow = new Date(now.getTime() + HaOffsetMs + deviceOffsetSecs * 1000);
                const currentYear = deviceNow.getFullYear();
                const startYear = 2020;

                // 生成从 2020 到当前年份的数组
                const years = [];
                for (let y = startYear; y <= currentYear; y++) {
                    years.push(y);
                }
                return {
                    label: label,
                    timeline: years,
                    values: new Array(years.length).fill(0),
                    isFilled: true
                };
            }
        });

        // 等待所有数据获取并处理完成
        const resolvedData = await Promise.all(fetchPromises);
        const validData = resolvedData.filter(data => data !== null);

        //检查是否存在填充数据
        const hasFilledData = validData.some(data => data.isFilled);
        console.log("hasFilledData:", hasFilledData);
        // 过滤掉可能的错误项（虽然上面有 try-catch，但为了严谨）
        return {
            filled:hasFilledData,
            data: validData
        };
    }

    async handleHistoryData_total(powerType, respond, deviceOffsetSecs) {
        try {
            // console.log("respond:", respond);
            // 提取对应类型的历史数据
            const historyRaw = respond["serial"][powerType] || [];
            const timelineRaw = respond["serial"]["add_time"] || [];
            // console.log(`raw ${powerType} data:`, historyRaw);
            // console.log(`raw timeline data:`, timelineRaw);


            if (!timelineRaw || timelineRaw.length === 0) {
                throw new Error('No data available'); // 抛出错误，触发 catch
            }

            const yearMap = {};
            let minYear = Infinity;
            let maxYear = 0;


            // 遍历时间轴，存储索引获取对应数值
            let index = 0;
            timelineRaw.forEach(time => {
                const value = historyRaw[index] / 1000 || 0;
                if (isNaN(value)) return;

                index += 1;
                // 获取系统时间偏差
                let date = new Date();
                const HaOffsetMs = date.getTimezoneOffset() * 60 * 1000; //HA偏移
                // console.log("deviceOffsetSecs:", deviceOffsetSecs);
                let deviceTime = time * 1000 + HaOffsetMs + deviceOffsetSecs * 1000;
                // console.log("deviceTime:", deviceTime);
                let deviceDate = new Date(deviceTime);
                // 2. 格式化为年数(这是设备本地的时间，也就是你想在X轴显示的时间)
                const year = deviceDate.getFullYear(); // "2020-~"
                yearMap[year] = value;

                minYear = Math.min(minYear, year);
                maxYear = Math.max(maxYear, year);
                console.log("min:", minYear, "max:", maxYear);
            });
            const result = {
                timeline: [],
                values: []
            };
            for (let year = minYear; year <= maxYear; year++) {
                result.timeline.push(year);
                result.values.push(yearMap[year] || 0);
            }
            // console.log('result:', result);
            return result;
        } catch (error) {
            console.error('拉取处理总数据失败:', error);
            throw error;
        }
    }

    async getHistoryData(deviceOffsetSecs, chart_type) {
        let result = null;
        console.log("chat:", chart_type);
        if (chart_type == "day") {
            result = await this.getHistoryData_day(deviceOffsetSecs);
        }
        else if (chart_type == "month") {
            result = await this.getHistoryData_month(deviceOffsetSecs);
        }
        else if (chart_type == "year") {
            result = await this.getHistoryData_year(deviceOffsetSecs);
        }
        else if (chart_type == "total") {
            result = await this.getHistoryData_total(deviceOffsetSecs);
        }
        return result;
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
            // console.log('设备信息原始数据:', data);
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
                timezone: isNaN(data.info.timezone) ? null : data.info.timezone,
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