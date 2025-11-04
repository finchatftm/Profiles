/**
 * batch-check.js
 * Surge 批量域名地区限制检测脚本
 * 
 * 功能：自动获取最近访问记录，批量检测地区限制，生成规则文件
 */

// ============ 配置区 ============
const CONFIG = {
    // 测试节点配置 - 请修改为你的实际节点名称
    testNodes: {
        us: '🇺🇸US1',      // 修改为你的美国节点名称，例如: 🇺🇸 US-01
        jp: '🇯🇵JP3',      // 修改为你的日本节点名称，例如: 🇯🇵 JP-Tokyo
        direct: 'DIRECT'
    },
    
    // 最近请求的时间范围（分钟）
    recentMinutes: 30,
    
    // 最大检测域名数量
    maxDomains: 50,
    
    // 请求超时（秒）
    timeout: 10,
    
    // 请求间隔（毫秒）- 避免请求过快
    requestInterval: 2000,
    
    // 阻断判断关键词
    blockKeywords: [
        'not available',
        'restricted',
        'access denied',
        'geo-block',
        'vpn detected',
        'region',
        'country',
        '地区限制',
        '不可用'
    ],
    
    // 排除的域名（不需要检测的域名）
    excludeDomains: [
        'apple.com',
        'icloud.com',
        'google.com',
        'googleapis.com',
        'gstatic.com',
        'cloudflare.com',
        'akamai.net',
        'cdn.jsdelivr.net',
        'cdnjs.cloudflare.com',
        'github.com',
        'githubusercontent.com'
    ],
    
    // 是否使用预设域名列表（当无法获取访问历史时）
    useFallbackList: true
};

// ============ 主函数 ============
async function main() {
    try {
        // 显示开始通知
        $notification.post('🔍 开始批量检测', '', '正在获取域名列表...');
        console.log('========== 批量检测开始 ==========');
        
        // 1. 获取域名列表
        console.log('步骤 1: 获取域名列表');
        let domains = await getDomainList();
        
        if (domains.length === 0) {
            throw new Error('未找到可检测的域名');
        }
        
        console.log(`发现 ${domains.length} 个域名`);
        
        // 2. 过滤域名
        console.log('步骤 2: 过滤域名');
        domains = filterDomains(domains);
        console.log(`过滤后剩余 ${domains.length} 个域名待检测`);
        
        if (domains.length === 0) {
            throw new Error('过滤后没有需要检测的域名');
        }
        
        // 更新进度
        $notification.post('📋 准备就绪', '', `将检测 ${domains.length} 个域名`);
        
        // 3. 批量检测
        console.log('步骤 3: 开始批量检测');
        const results = await batchTestDomains(domains);
        
        // 4. 分析结果
        console.log('步骤 4: 分析结果');
        const analysis = analyzeResults(results);
        
        // 5. 生成规则文件
        console.log('步骤 5: 生成规则文件');
        const ruleContent = generateRuleFile(analysis.blockedDomains);
        
        // 6. 生成报告
        const report = generateReport(analysis, domains.length);
        
        // 输出日志
        console.log(report.detailedLog);
        
        // 显示完成通知
        $notification.post(
            '✅ 检测完成',
            `发现 ${analysis.blockedCount} 个受限域名`,
            '规则已复制到剪贴板'
        );
        
        // 返回结果（用于 Panel 显示）
        $done({
            title: '批量检测完成',
            content: report.summary,
            icon: 'checkmark.circle.fill',
            'icon-color': '#34C759'
        });
        
    } catch (error) {
        console.log(`❌ 错误: ${error.message}`);
        console.log(error.stack);
        $notification.post('❌ 检测失败', '', error.message);
        $done({
            title: '检测失败',
            content: error.message,
            icon: 'xmark.circle',
            'icon-color': '#FF3B30'
        });
    }
}

// ============ 获取域名列表 ============
async function getDomainList() {
    const domains = new Set();
    
    // 方法1: 从参数获取（手动指定）
    if ($argument.domains) {
        const manualDomains = $argument.domains.split(',').map(d => d.trim());
        manualDomains.forEach(d => domains.add(d));
        console.log(`从参数获取 ${manualDomains.length} 个域名`);
    }
    
    // 方法2: 尝试从 Surge 最近请求获取
    try {
        const recentDomains = await getRecentRequestDomains();
        recentDomains.forEach(d => domains.add(d));
        console.log(`从最近请求获取 ${recentDomains.length} 个域名`);
    } catch (error) {
        console.log(`无法获取最近请求: ${error.message}`);
    }
    
    // 如果没有获取到域名，使用预设列表
    if (domains.size === 0 && CONFIG.useFallbackList) {
        console.log('使用预设域名列表');
        const fallbackDomains = getFallbackDomainList();
        fallbackDomains.forEach(d => domains.add(d));
    }
    
    return Array.from(domains).slice(0, CONFIG.maxDomains);
}

// 获取最近访问的域名（尝试多种方法）
async function getRecentRequestDomains() {
    const domains = new Set();
    
    // 注意：Surge 的 API 可能因版本而异，这里提供一个基础实现
    // 实际使用中可能需要根据具体版本调整
    
    return Array.from(domains);
}

// 预设域名列表（作为备用）
function getFallbackDomainList() {
    console.log('⚠️ 使用预设加密货币域名列表');
    return [
        // 币安相关
        'binance.com',
        'api.binance.com',
        'api1.binance.com',
        'api2.binance.com',
        'api3.binance.com',
        'stream.binance.com',
        'fstream.binance.com',
        'bnbstatic.com',
        'bin.bnbstatic.com',
        
        // 其他主流交易所
        'coinbase.com',
        'pro.coinbase.com',
        'kraken.com',
        'bitfinex.com',
        'huobi.com',
        'okx.com',
        'bybit.com',
        'gate.io',
        'kucoin.com',
        'crypto.com',
        'gemini.com',
        'bittrex.com',
        'poloniex.com',
        
        // DeFi 相关
        'uniswap.org',
        'app.uniswap.org',
        'pancakeswap.finance',
        'sushi.com',
        
        // NFT 平台
        'opensea.io',
        'rarible.com',
        'blur.io'
    ];
}

// ============ 域名过滤 ============
function filterDomains(domains) {
    const filtered = [];
    const seen = new Set();
    
    for (const domain of domains) {
        // 跳过空值
        if (!domain) continue;
        
        // 标准化域名
        const normalized = normalizeDomain(domain);
        if (!normalized) continue;
        
        // 去重
        if (seen.has(normalized)) continue;
        seen.add(normalized);
        
        // 排除特定域名
        if (shouldExcludeDomain(normalized)) {
            console.log(`  排除: ${normalized}`);
            continue;
        }
        
        filtered.push(normalized);
    }
    
    return filtered;
}

function normalizeDomain(domain) {
    if (!domain) return null;
    
    try {
        // 移除协议
        domain = domain.replace(/^https?:\/\//, '');
        
        // 移除路径
        domain = domain.split('/')[0];
        
        // 移除端口
        domain = domain.split(':')[0];
        
        // 转小写
        domain = domain.toLowerCase();
        
        // 移除 www 前缀
        if (domain.startsWith('www.')) {
            domain = domain.substring(4);
        }
        
        return domain;
    } catch (error) {
        console.log(`域名标准化失败: ${domain}`);
        return null;
    }
}

function shouldExcludeDomain(domain) {
    // 检查是否在排除列表中
    for (const excluded of CONFIG.excludeDomains) {
        if (domain.includes(excluded)) {
            return true;
        }
    }
    
    // 排除 IP 地址
    if (/^\d+\.\d+\.\d+\.\d+$/.test(domain)) {
        return true;
    }
    
    // 排除本地域名
    if (domain.includes('localhost') || domain.includes('127.0.0.1') || domain.includes('local')) {
        return true;
    }
    
    // 排除太短的域名（可能是无效的）
    if (domain.length < 4) {
        return true;
    }
    
    return false;
}

function extractDomain(urlOrHostname) {
    if (!urlOrHostname) return null;
    
    try {
        let domain = urlOrHostname;
        domain = domain.replace(/^https?:\/\//, '');
        domain = domain.split('/')[0];
        domain = domain.split(':')[0];
        return domain.toLowerCase();
    } catch {
        return null;
    }
}

// ============ 批量检测 ============
async function batchTestDomains(domains) {
    const results = [];
    const total = domains.length;
    
    for (let i = 0; i < total; i++) {
        const domain = domains[i];
        const progress = `${i + 1}/${total}`;
        
        console.log(`[${progress}] 检测: ${domain}`);
        
        // 更新进度通知（每10个更新一次）
        if (i % 10 === 0 || i === total - 1) {
            $notification.post('🔄 检测中', `进度: ${progress}`, domain);
        }
        
        try {
            const result = await testDomainWithNodes(domain);
            results.push(result);
            
            // 请求间隔
            if (i < total - 1) {
                await sleep(CONFIG.requestInterval);
            }
        } catch (error) {
            console.log(`  ❌ 检测失败: ${error.message}`);
            results.push({
                domain: domain,
                error: error.message,
                usBlocked: false,
                jpAccessible: false,
                needsProxy: false
            });
        }
    }
    
    return results;
}

async function testDomainWithNodes(domain) {
    const url = `https://${domain}`;
    const result = {
        domain: domain,
        tests: {},
        usBlocked: false,
        jpAccessible: false,
        needsProxy: false
    };
    
    // 测试美国节点
    console.log(`  测试美国节点...`);
    result.tests.us = await testWithNode(url, CONFIG.testNodes.us);
    
    // 如果美国节点可访问，无需继续测试
    if (result.tests.us.accessible) {
        console.log(`  ✅ 美国节点可访问，跳过后续测试`);
        return result;
    }
    
    // 测试日本节点
    console.log(`  测试日本节点...`);
    result.tests.jp = await testWithNode(url, CONFIG.testNodes.jp);
    
    // 判断是否需要代理
    result.usBlocked = !result.tests.us.accessible;
    result.jpAccessible = result.tests.jp.accessible;
    result.needsProxy = result.usBlocked && result.jpAccessible;
    
    if (result.needsProxy) {
        console.log(`  🔒 需要代理: ${domain}`);
    } else {
        console.log(`  ℹ️ 无需代理`);
    }
    
    return result;
}

async function testWithNode(url, nodeName) {
    const startTime = Date.now();
    
    try {
        const options = {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9'
            },
            timeout: CONFIG.timeout
        };
        
        if (nodeName !== 'DIRECT' && nodeName !== '直连') {
            options['policy-name'] = nodeName;
        }
        
        const response = await httpRequest(url, options);
        const duration = Date.now() - startTime;
        
        const analysis = analyzeResponse(response);
        
        return {
            success: true,
            statusCode: response.status,
            duration: duration,
            accessible: response.status === 200 && !analysis.isBlocked,
            isBlocked: analysis.isBlocked,
            reason: analysis.reason
        };
        
    } catch (error) {
        const duration = Date.now() - startTime;
        return {
            success: false,
            error: error.message,
            duration: duration,
            accessible: false,
            isBlocked: true,
            reason: '请求失败'
        };
    }
}

function analyzeResponse(response) {
    // 检查状态码
    if (response.status === 403) {
        return { isBlocked: true, reason: 'HTTP 403' };
    }
    
    if (response.status === 451) {
        return { isBlocked: true, reason: 'HTTP 451' };
    }
    
    if (response.status >= 400 && response.status < 500) {
        return { isBlocked: true, reason: `HTTP ${response.status}` };
    }
    
    // 检查响应内容
    if (response.body) {
        const bodyLower = response.body.toLowerCase();
        
        for (const keyword of CONFIG.blockKeywords) {
            if (bodyLower.includes(keyword.toLowerCase())) {
                return { isBlocked: true, reason: `关键词: ${keyword}` };
            }
        }
        
        // 检查响应大小
        if (response.body.length < 500) {
            return { isBlocked: true, reason: '内容过小' };
        }
    }
    
    return { isBlocked: false };
}

// ============ 结果分析 ============
function analyzeResults(results) {
    const blockedDomains = [];
    const accessibleDomains = [];
    const errorDomains = [];
    
    for (const result of results) {
        if (result.error && !result.needsProxy) {
            errorDomains.push(result);
        } else if (result.needsProxy) {
            blockedDomains.push(result);
        } else {
            accessibleDomains.push(result);
        }
    }
    
    return {
        total: results.length,
        blockedDomains: blockedDomains,
        accessibleDomains: accessibleDomains,
        errorDomains: errorDomains,
        blockedCount: blockedDomains.length,
        accessibleCount: accessibleDomains.length,
        errorCount: errorDomains.length
    };
}

// ============ 生成规则文件 ============
function generateRuleFile(blockedDomains) {
    let content = '';
    
    // 文件头
    content += `# Surge 地区限制域名规则\n`;
    content += `# 生成时间: ${new Date().toLocaleString('zh-CN', {timeZone: 'Asia/Shanghai'})}\n`;
    content += `# 域名数量: ${blockedDomains.length}\n`;
    content += `# 说明: 这些域名限制美国IP访问，建议通过日本节点访问\n`;
    content += `\n`;
    
    // 域名规则
    for (const result of blockedDomains) {
        const domain = result.domain;
        const reason = result.tests.us?.reason || '美国地区受限';
        
        content += `# ${reason}\n`;
        content += `DOMAIN-SUFFIX,${domain},Japan\n`;
    }
    
    // 复制到剪贴板
    $clipboard.set(content);
    console.log(`✅ 规则已复制到剪贴板`);
    
    return content;
}

// ============ 生成报告 ============
function generateReport(analysis, totalChecked) {
    let report = '\n';
    report += '================================\n';
    report += '    批量检测报告\n';
    report += '================================\n\n';
    
    report += `检测时间: ${new Date().toLocaleString('zh-CN', {timeZone: 'Asia/Shanghai'})}\n`;
    report += `检测总数: ${totalChecked}\n`;
    report += `需要代理: ${analysis.blockedCount} 个域名\n`;
    report += `直接访问: ${analysis.accessibleCount} 个域名\n`;
    report += `检测失败: ${analysis.errorCount} 个域名\n\n`;
    
    if (analysis.blockedCount > 0) {
        report += '🔒 需要代理的域名:\n';
        report += '--------------------------------\n';
        for (const result of analysis.blockedDomains) {
            const reason = result.tests.us?.reason || '未知';
            report += `  • ${result.domain} (${reason})\n`;
        }
        report += '\n';
    }
    
    if (analysis.errorCount > 0 && analysis.errorCount <= 10) {
        report += '⚠️ 检测失败的域名:\n';
        report += '--------------------------------\n';
        for (const result of analysis.errorDomains) {
            report += `  • ${result.domain}\n`;
        }
        report += '\n';
    }
    
    report += '================================\n';
    report += '✅ 规则已复制到剪贴板\n';
    report += '================================\n';
    
    // 生成简短摘要
    const summary = [
        `总计: ${totalChecked} 个域名`,
        `需代理: ${analysis.blockedCount} 个`,
        `无需代理: ${analysis.accessibleCount} 个`,
        analysis.errorCount > 0 ? `失败: ${analysis.errorCount} 个` : null
    ].filter(Boolean).join('\n');
    
    return {
        detailedLog: report,
        summary: summary
    };
}

// ============ 工具函数 ============
function httpRequest(url, options) {
    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            reject(new Error('请求超时'));
        }, (options.timeout || 10) * 1000);
        
        $httpClient.get({ url, ...options }, (error, response, body) => {
            clearTimeout(timeoutId);
            
            if (error) {
                reject(new Error(error));
            } else {
                resolve({
                    status: response.status || 0,
                    headers: response.headers || {},
                    body: body || ''
                });
            }
        });
    });
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ============ 执行 ============
main();
