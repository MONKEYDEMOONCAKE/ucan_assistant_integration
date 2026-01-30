/**
 * 加载多语言资源
 * @param {string} lang - 语言代码，如 'en' 或 'zh-cn'
 * @returns {Promise<Object>} 返回翻译对象
 */

const getScriptPath = () => {
    const script = document.currentScript || [...document.getElementsByTagName('script')].pop();

    // 核心修改：使用 split 和 slice 来移除最后一个部分（文件名）
    return script.src.split('/').slice(0, -1).join('/') + '/';
};
const BASE_PATH = getScriptPath();

export async function loadTranslations(lang = 'en') {
    // 定义默认语言，防止找不到文件
    const defaultLang = 'en';
    const translations = {};
    //console.log("lang:",lang);
    try {
        // 尝试加载翻译json

        const response = await fetch(`${BASE_PATH}json_files/translate.json`);
        if (response.ok) {
            Object.assign(translations, await response.json());
        } else {
            throw new Error(`Status ${response.status}`);
        }
    } catch (err) {
        console.log(`[i18n] 未找到语言包`);
    }
    //console.log("trans:",translations);
    return translations[lang] || translations[defaultLang];
}


/**
 * 加载逆变器型号
 * @returns {Promise<Object>} 返回逆变器型号对象
 */
export async function loadInverterModels() {
  const inverterModels = {};
  try {
    // 尝试加载逆变器型号json
    const response = await fetch(`${BASE_PATH}json_files/inv_model.json`);
    if (response.ok) {
      Object.assign(inverterModels, await response.json());
    } else {
      throw new Error(`Status ${response.status}`);
    }
  } catch (err) {
    console.log(`[data] 未找到文件 inv_model.json`);
  }
  return inverterModels;
}