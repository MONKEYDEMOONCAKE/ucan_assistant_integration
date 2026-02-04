// 导出所有样式，供核心类调用

const getScriptPath = () => {
    const script = document.currentScript || [...document.getElementsByTagName('script')].pop();

    // 核心修改：使用 split 和 slice 来移除最后一个部分（文件名）
    return script.src.split('/').slice(0, -1).join('/') + '/';
};
const BASE_PATH = getScriptPath();

export const UcanStyles = `
    /* 通用基础样式 */
    :host {
        display: block;
        width: 100%;
        box-sizing: border-box;
    }

    :root {
        --card-background-color: var(--ha-card-background, white);
        --secondary-background-color: var(--ha-secondary-background, #ffffffff);
        --primary-text-color: var(--ha-primary-text-color, #333);
        --secondary-text-color: var(--ha-secondary-text-color, #777);
        --primary-color: var(--ha-primary-color, #03a9f4);
        --success-color: var(--ha-success-color, #4CAF50);
        --error-color: var(--ha-error-color, #F44336);
    }

    /* 加载动画 */
    .spinner {
        display: inline-block;
        width: 16px;
        height: 16px;
        border: 2px solid rgba(0,0,0,0.1);
        border-radius: 50%;
        border-top-color: var(--primary-color);
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        to { transform: rotate(360deg); }
    }

    /* 响应式适配 */
    @media (max-width: 600px) {
        .device-list, .power-list {
            grid-template-columns: 1fr !important;
        }
        .flow-graph {
            gap: 12px !important;
        }
        .title {
            font-size: 16px !important;
        }
    }

    /* 头部样式 */
    .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px;
        border-bottom: 1px solid var(--border-color);
    }

    .title {
        font-size: 18px;
        font-weight: 500;
        color: var(--primary-text-color);
        margin: 0;
    }

    button {
        background: var(--primary-color);
        color: white;
        border: none;
        border-radius: 4px;
        padding: 8px 16px;
        cursor: pointer;
        font-size: 14px;
        transition: opacity 0.2s;
        outline: none;
    }

    button:hover {
        opacity: 0.9;
    }

    button:focus-visible {
        /* 新增：聚焦状态边框 */
        box-shadow: 0 0 0 2px rgba(3, 169, 244, 0.3);
    }

    button.back-btn, button.refresh-btn, button.power-button {
        background: transparent;
        color: var(--primary-text-color);
        padding: 4px 8px;
    }

    /* 列表页样式 */
    .device-list-page {
        width: 100%;
        padding: 16px;
        box-sizing: border-box;
    }

    .device-list {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
        gap: 16px;
        margin-top: 12px;
    }

    .device-card {
        background: var(--card-background-color);
        border-radius: 8px;
        padding: 16px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        cursor: pointer;
        transition: box-shadow 0.2s;
    }

    .device-card:hover {
        box-shadow: 0 4px 8px rgba(0,0,0,0.15);
    }

    .device-sn {
        font-family: monospace;
        font-size: 16px;
        font-weight: 600;
        color: var(--primary-text-color);
        margin-bottom: 8px;
    }

    .device-soc {
        font-size: 14px;
        color: var(--primary-text-color);
        margin-bottom: 4px;
    }

    .device-status {
        font-size: 12px;
        color: var(--secondary-text-color);
    }

    .soc-value {
        display: inline-block;
        min-width: 40px;
        padding: 4px 8px;
        border-radius: 12px;
        font-weight: 500;
        margin-left: 6px;
    }

    .soc-high {
        background: rgba(76, 175, 80, 0.1);
        color: #4CAF50;
    }

    .soc-medium {
        background: rgba(255, 152, 0, 0.1);
        color: #FF9800;
    }

    .soc-low {
        background: rgba(244, 67, 54, 0.1);
        color: #F44336;
    }

    /* 主页样式 */
    .energy-main-page {
        width: 100%;
        padding: 16px;
        box-sizing: border-box;
    }

    .device-info {
        padding: 16px;
        margin-bottom: 16px;
        background: var(--secondary-background-color);
        border-radius: 8px;
        border: 1px solid var(--border-color);
    }

    .device-name {
        font-size: 16px;
        font-weight: 600;
        color: var(--primary-text-color);
        margin-bottom: 4px;
    }

    .device-soc-detail {
        font-size: 14px;
        color: var(--secondary-text-color);
        margin-bottom: 4px;
    }

    .energy-flow-container {
        background: var(--card-background-color);
        border-radius: 8px;
        padding: 30px 16px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        margin-bottom: 20px;
        text-align: center;
    }

    .flow-title {
        font-size: 18px;
        font-weight: 500;
        color: var(--primary-text-color);
        margin-bottom: 20px;
        text-align: center;
    }

    .text-center {
        font-size: 12px;
        font-weight: 500;
        color: var(--secondary-text-color);
        margin-bottom: 20px;
        text-align: center;
    }

    /* 能量流向图容器：相对定位，用于子元素绝对定位 */
    .flow-graph {
        position: relative;
        width: 100%;
        max-width: 450px;
        height: 600px; /* 固定高度，确保布局稳定 */
        margin: 0 auto; /* 容器居中 */
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 24px;
        flex-wrap: wrap;
        min-height: 600px;
    }

    /* 中心房子样式 */
    .house {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 450px;
        height: 391px;
        /* 新增：防止子元素溢出，方便调试 */
        overflow: visible;
        box-sizing: border-box;
        background-color: #fff;
        z-index: 1;
    }
    /* 房子主体 */
    .house-shape {
        width: 100%;
        height: 100%;
        /* 核心：设置背景图片 */
        background-image: url('${BASE_PATH}src/house_clear.png'); /* 本地路径 */
        /* 让图片适配容器 */
        background-size: cover; /* 覆盖整个容器, 保持比例(可选contain/100% 100%) */
        background-position: center; /* 图片居中显示 */
        background-repeat: no-repeat; /* 禁止重复 */
        background-color: transparent;      //透明，父容器白色
        position: relative;
        box-sizing: border-box; /* 确保边框不撑开容器，图片适配更准确 */
    }

    .flow-node {
        position: absolute;
        min-width: 80px;
        min-height: 40px;
        text-align: center;
        font-size: 14px;
        z-index: 3;
    }

    /* 太阳能节点 */
    .solar-node {
        top: 70px;
        right: 80px;
    }
    /* 电网节点 */
    .grid-node {
        top: 50px;
        right: 15px;
    }
    /* 电池节点 */
    .battery-node {
        bottom: 200px;
        left: 150px;
    }
    /* 负载节点 */
    .load-node {
        bottom: 180px;
        right: 40px;
    }


    .node-label {
        font-size: 14px;
        color: var(--secondary-text-color);
        margin-bottom: 6px;
    }

    .node-value {
        font-family: monospace;
        font-size: 16px;
        font-weight: 600;
        color: var(--primary-text-color);
    }

    /* 箭头通用样式：绝对定位，默认隐藏 */
    .flow-arrow {
        position: absolute;
        font-size: 30px;
        opacity: 0;
        transition: opacity 0.3s ease;
    }
    /* 太阳能→房子的箭头：房子上方中间 */
    .solar-arrow {
        top: 180px;
        right: 95px;
        color: #4bf806ff;
    }

    /* 电网↔房子的箭头：房子右侧中间 */
    .grid-arrow {
        top: 150px;
        right: 30px;
        color: #f8c006ff;
    }
    /* 电池↔房子的箭头：房子右下方 */
    .battery-arrow {
        bottom: 300px;
        left: 250px;
        color: #f8c006ff;
    }
    /* 房子→负载的箭头：房子左侧中间 */
    .load-arrow {
        bottom: 260px;
        right: 60px;
        color: #f8c006ff;
    }
    /* 功率非零时显示箭头 */
    .flow-arrow.active {
        opacity: 1;
    }

    /* SVG：绝对定位覆盖在背景图上 */
    .energy-svg {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none; /* 避免SVG遮挡交互（可选） */
        z-index: 2;
    }
    /* 能量路径的基础样式 */
    .hidden-path {
        fill: none;
        stroke: transparent;
        stroke-width: 0;
    }
    /* 流动圆点的样式 */
    .flow-dot {
        r: 3;
        fill: #FFC107; /* 圆点基础颜色 */
        filter: drop-shadow(0 0 2px #4CAF50) drop-shadow(0 0 4px #4CAF50); /* 多层叠加增强发光效果 */
        transform: translateZ(0);
        will-change: transform;
    }
    .pv-flow-dot {
        r: 3;
        fill: #4CAF50; /* 圆点基础颜色 */
        filter: drop-shadow(0 0 2px #4CAF50) drop-shadow(0 0 4px #4CAF50); /* 多层叠加增强发光效果 */
        transform: translateZ(0);
        will-change: transform;
    }


    /* ------- 功率表 ------------ */
    .power-list {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 12px;
        background: var(--card-background-color);
        border-radius: 8px;
        padding: 20px 16px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .power-item {
        justify-content: space-between;
        align-items: center;
        padding: 14px 16px;
        background: var(--secondary-background-color);
        border-radius: 6px;
        color: var(--secondary-text-color);
    }

    .power-label {
        font-size: 14px;
        font-weight: 500;

    }

    .power-value {
        font-family: monospace;
        font-size: 18px;
        font-weight: 600;
        margin-left: auto;
        text-align: left;
    }

    .power-positive {
        color: var(--success-color);
    }

    .power-negative {
        color: var(--error-color);
    }

    /* 状态提示 */
    .loading, .error, .no-devices, .no-device-selected {
        padding: 16px;
        text-align: center;
        color: var(--secondary-text-color);
    }

    .error {
        color: var(--error-color);
    }

    .header-actions {
        display: flex;
        align-items: center;
        gap: 8px;
    }
    .jump-select {
        height: 28px;
        padding: 0 6px;
    }

    .detail-button{
        display: flex;          /* 启用Flex布局 */
        justify-content: space-between; /* 按键两端对齐，中间间距均匀 */
        width: 100%;            /* 占满父容器宽度（关键：否则对齐不生效） */
        gap: 8px;               /* 可选：设置按键之间的最小间距，避免过挤 */
        margin: 16px 0;         /* 可选：上下间距，优化排版 */
    }

    .detail-button button {
        width: 80px; /* 固定宽度，可根据需求调整 */
        height: 40px; /* 固定高度，可根据需求调整 */
        padding: 0; /* 清除默认内边距，避免影响尺寸 */
        border: 1px solid #8a8a8aff;
        border-radius: 4px;
        background-color: rgba(var(--rgb-primary-color), 0.15);
        cursor: pointer;
        /* 可选：文字居中，优化视觉 */
        color: var(--primary-text-color);
        align-items: center;
        justify-content: center;
    }

    .info-list {
        width: 100%;
        background-color: #fff;
        border: 1px solid #e5e5e5;
        border-radius: 8px;
        padding: 8px 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }

    .info-title {
        font-size: 16px;
        font-weight: 600;
        color: var(--primary-text-color);
        background-color: rgba(var(--rgb-primary-color), 0.15);
        padding: 8px 16px;
    }

    /* 单个信息项样式 */
    .info-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        border-bottom: 1px solid #f5f5f5; /* 分隔线 */
    }

    .info-grid {
        /* 使用 Grid 布局，定义 6 列 */
        display: grid;
        grid-template-columns: 1fr 1fr 1fr 1fr 1fr 1fr;
        /* 上面这行代码把一行分为6等份，分别给 3组(标签+数值) 使用 */
        grid-column-gap: 32px;
        align-items: center;
        padding: 12px 16px;
        border-bottom: 1px solid #f5f5f5;
    }

    /* 最后一项移除底部分隔线 */
    .info-item:last-child {
        border-bottom: none;
    }

    /* 标签样式（左侧文本） */
    .info-label {
        color: #333;
        font-size: 14px;
    }

    /* 值样式（右侧文本） */
    .info-value {
        color: #666;
        font-size: 14px;
        text-align: right;
    }

    .event-card {
        background: var(--card-background-color);
        border-radius: 8px;
        padding: 16px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        cursor: pointer;
        transition: box-shadow 0.2s;
        border: 2px
    }

    .event-alarm {
        font-family: monospace;
        font-size: 16px;
        font-weight: 600;
        color: rgba(245, 197, 65, 0.7);
        margin-bottom: 8px;
    }

    .event-error {
        font-family: monospace;
        font-size: 18px;
        font-weight: 600;
        color: rgba(245, 71, 65, 0.7);
        margin-bottom: 8px;
    }

    .event-item {
        font-family: monospace;
        font-size: 14px;
        font-weight: 600;
        color: var(--secondary-text-color);
        margin-bottom: 8px;
    }

    .no-data {
        font-family: monospace;
        font-size: 14px;
        font-weight: 600;
        color: var(--secondary-text-color);
        margin-bottom: 8px;
        text-align: center;
    }

    /* 日期选择区域样式 */
    .date-selector {
        display: flex;
        align-items: center;
        justify-content: center;
        margin-top: 20px;
        gap: 15px;
        font-size: 18px;
    }
    /* 箭头按钮样式 */
    .date-btn {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        border: 1px solid #2196F3;
        background-color: #fff;
        color: #2196F3;
        font-size: 20px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        transition: all 0.2s ease;
    }
    .date-btn:hover {
        background-color: #2196F3;
        color: #fff;
    }
    .date-btn:disabled {
        border-color: #ccc;
        color: #ccc;
        cursor: not-allowed;
        background-color: #f5f5f5;
    }
    /* 当前日期样式 */
    .current-date {
        color: #333;
        font-weight: 500;
        min-width: 120px;
        text-align: center;
    }


    .ucan-container {
        max-width: 50%;          /* 占据 1/2 宽度 */
        margin: 0 auto;          /* 水平居中 */
        padding: 16px;
        background: var(--card-background-color, #fff);
        border-radius: var(--ha-card-border-radius, 12px);
    }

    /* 移动端适配：小屏幕时占满宽度 */
    @media (max-width: 768px) {
        .ucan-container {
        max-width: 100%;
        margin: 0;
        }
    }


`;