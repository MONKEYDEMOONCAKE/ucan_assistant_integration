//  数值判断返回样式类
export const UcanUtils = {

    //电量
    getSocClass(soc) {
        if (soc > 70) return 'soc-high';
        if (soc > 30) return 'soc-medium';
        return 'soc-low';
    },

    //功率正负
    getPowerClass(power) {
        if (power >= 0) return 'power-positive';
        return 'power-negative';
    },

    // 清理轮询定时器
    clearPolling(timeid) {
        if (timeid) {
            clearInterval(timeid);
            return null;
        }
    }
};