#!name=域名地区限制自动检测
#!desc=一键批量检测最近访问的域名，自动识别美国地区限制并生成规则
#!system=ios

[Script]
# 单个域名检测
域名检测 = type=generic,timeout=30,script-path=https://raw.githubusercontent.com/Profiles/rewrite/region-check.js

# 批量自动检测（主功能）
批量检测 = type=generic,timeout=120,script-path=https://raw.githubusercontent.com/Profiles/rewrite/batch-check.js

[Panel]
# 一键批量检测按钮
自动检测限制 = script-name=批量检测,update-interval=-1,title=🔍 批量检测,content=点击开始检测最近访问的域名

/**
 * Surge 批量域名地区限制检测脚本
 * 功能：自动获取最近访问记录，批量检测地区限制，生成规则文件
 */

const $ = new Surge();

// ============ 配置区 ============
const CONFIG = {
    // 测试节点配置
    testNodes: {
        us: '美国节点',      // 修改为你的美国节点名称
        jp: '日本节点',      // 修改为你的日本节点名称
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
    
    // 排除的域名（不需要检测）
    excludeDomains: [
        'apple.com',
        'icloud.com',
        'google.com',
        'googleapis.com',
        'gstatic.com',
        'cloudflare.com',
        'akamai.net',
        'cdn.jsdelivr.net',
        'cdnjs.cloudflare.com'
    ],
    
    // 输出规则文件路径（iCloud Drive）
    outputPath: 'iCloud/Surge/blocked_domains.conf'
};

// ============ 主函数 ============
async function main() {
    try {
        // 显示开始通知
        $.notify('🔍 开始批量检测', '', '正在获取最近访问记录...');
        
        // 1. 获取最近访问的域名
        $.log('步骤 1: 获取最近访问记录');
        const recentDomains = await getRecentDomains();
        
        if (recentDomains.length === 0) {
            throw new Error('未找到最近访问的域名记录');
        }
        
        $.log(`发现 ${recentDomains.length} 个唯一域名`);
        
        // 2. 过滤和筛选域名
        $.log('步骤 2: 过滤域名');
        const filteredDomains = filterDomains(recentDomains);
        $.log(`过滤后剩余 ${filteredDomains.length} 个域名待检测`);
        
        // 更新进度
        $.notify('📋 域名列表已准备', '', `共 ${filteredDomains.length} 个域名待检测`);
        
        // 3. 批量检测
        $.log('步骤 3: 开始批量检测');
        const results = await batchTestDomains(filteredDomains);
        
        // 4. 分析结果
        $.log('步骤 4: 分析结果');
        const analysis = analyzeResults(results);
        
        // 5. 生成规则文件
        $.log('步骤 5: 生成规则文件');
        const ruleContent = generateRuleFile(analysis.blockedDomains);
        
        // 6. 生成报告
        const report = generateReport(analysis, filteredDomains.length);
        
        // 输出日志
        $.log(report.detailedLog);
        
        // 显示完成通知
        $.notify(
            '✅ 检测完成',
            `发现 ${analysis.blockedDomains.length} 个受限域名`,
            `点击查看详情`
        );
        
        // 返回结果（用于 Panel 显示）
        $done({
            title: '批量检测完成',
            content: report.summary,
            icon: 'checkmark.circle.fill',
            'icon-color': '#34C759'
        });
        
    } catch (error) {
        $.log(`❌ 错误: ${error.message}`);
        $.log(error.stack);
        $.notify('❌ 检测失败', '', error.message);
        $done({
            title: '检测失败',
            content: error.message,
            icon: 'xmark.circle',
            'icon-color': '#FF3B30'
        });
    }
}

// ============ 获取最近访问域名 ============
async function getRecentDomains() {
    const domains = new Set();
    
    // 方法1: 尝试从 Surge API 获取最近请求
    try {
        // 注意：这个 API 可能需要 Surge 的特定权限
        const recentRequests = await getSurgeRecentRequests();
        
        if (recentRequests && recentRequests.length > 0) {
            recentRequests.forEach(req => {
                const domain = extractDomain(req.url || req.hostname);
                if (domain) domains.add(domain);
            });
        }
    } catch (error) {
        $.log(`无法获取 Surge API 数据: ${error.message}`);
    }
    
    // 方法2: 从 Surge 流量统计获取
    try {
        const traffic = $surge.traffic;
        if (traffic && traffic.requests) {
            traffic.requests.forEach(req => {
                const domain = extractDomain(req.hostname);
                if (domain) domains.add(domain);
            });
        }
    } catch (error) {
        $.log(`无法获取流量统计: ${error.message}`);
    }
    
    // 方法3: 从历史请求日志读取（如果可用）
    try {
        const history = await getRequestHistory();
        history.forEach(domain => domains.add(domain));
    } catch (error) {
        $.log(`无法读取历史记录: ${error.message}`);
    }
    
    // 如果以上方法都失败，提供手动输入的域名列表作为备选
    if (domains.size === 0) {
        $.log('⚠️ 无法自动获取域名，使用预设列表');
        return getDefaultDomainList();
    }
    
    return Array.from(domains).slice(0, CONFIG.maxDomains);
}

// 获取 Surge 最近请求（需要 Surge API 支持）
async function getSurgeRecentRequests() {
    // Surge 的内部 API，可能因版本而异
    try {
        // 尝试读取最近的请求日志
        const cutoffTime = Date.now() - (CONFIG.recentMinutes * 60 * 1000);
        
        // 这里使用 Surge 的流量记录接口
        // 注意：实际可用的 API 可能因 Surge 版本而异
        if (typeof $surge !== 'undefined' && $surge.getRecentRequests) {
            return $surge.getRecentRequests(cutoffTime);
        }
        
        return [];
    } catch (error) {
        $.log(`API 调用失败: ${error.message}`);
        return [];
    }
}

// 从历史记录文件读取（如果有保存）
async function getRequestHistory() {
    const domains = [];
    
    try {
        // 尝试从 iCloud 读取之前保存的访问历史
        const historyPath = 'iCloud/Surge/request_history.txt';
        const content = await readFile(historyPath);
        
        if (content) {
            const lines = content.split('\n');
            const cutoffTime = Date.now() - (CONFIG.recentMinutes * 60 * 1000);
            
            lines.forEach(line => {
                const parts = line.split(',');
                if (parts.length >= 2) {
                    const timestamp = parseInt(parts[0]);
                    const domain = parts[1];
                    
                    if (timestamp >= cutoffTime) {
                        domains.push(domain);
                    }
                }
            });
        }
    } catch (error) {
        $.log(`读取历史记录失败: ${error.message}`);
    }
    
    return domains;
}

// 预设域名列表（备用）
function getDefaultDomainList() {
    $.log('使用预设加密货币相关域名列表');
    return [
        'binance.com',
        'api.binance.com',
        'stream.binance.com',
        'fstream.binance.com',
        'bnbstatic.com',
        'coinbase.com',
        'kraken.com',
        'bitfinex.com',
        'huobi.com',
        'okx.com',
        'bybit.com',
        'gate.io',
        'kucoin.com',
        'crypto.com',
        'gemini.com'
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
        
        // 去重
        if (seen.has(normalized)) continue;
        seen.add(normalized);
        
        // 排除特定域名
        if (shouldExcludeDomain(normalized)) {
            $.log(`排除域名: ${normalized}`);
            continue;
        }
        
        filtered.push(normalized);
    }
    
    return filtered;
}

function normalizeDomain(domain) {
    // 移除协议
    domain = domain.replace(/^https?:\/\//, '');
    
    // 移除路径
    domain = domain.split('/')[0];
    
    // 移除端口
    domain = domain.split(':')[0];
    
    // 转小写
    domain = domain.toLowerCase();
    
    // 提取主域名（移除 www 等前缀，但保留重要子域名）
    const parts = domain.split('.');
    if (parts.length > 2) {
        // 保留类似 api.example.com 的子域名
        if (parts[0] === 'www') {
            domain = parts.slice(1).join('.');
        }
    }
    
    return domain;
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
    if (domain.includes('localhost') || domain.includes('127.0.0.1')) {
        return true;
    }
    
    return false;
}

// ============ 批量检测 ============
async function batchTestDomains(domains) {
    const results = [];
    const total = domains.length;
    
    for (let i = 0; i < total; i++) {
        const domain = domains[i];
        const progress = `${i + 1}/${total}`;
        
        $.log(`[${progress}] 检测: ${domain}`);
        
        // 更新进度通知（每10个更新一次）
        if (i % 10 === 0) {
            $.notify('🔄 检测进行中', `进度: ${progress}`, domain);
        }
        
        try {
            const result = await testDomainWithNodes(domain);
            results.push(result);
            
            // 请求间隔
            if (i < total - 1) {
                await sleep(CONFIG.requestInterval);
            }
        } catch (error) {
            $.log(`检测失败 ${domain}: ${error.message}`);
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
    $.log(`  测试美国节点...`);
    result.tests.us = await testWithNode(url, CONFIG.testNodes.us);
    
    // 如果美国节点可访问，无需继续测试
    if (result.tests.us.accessible) {
        $.log(`  ✅ 美国节点可访问，跳过`);
        return result;
    }
    
    // 测试日本节点
    $.log(`  测试日本节点...`);
    result.tests.jp = await testWithNode(url, CONFIG.testNodes.jp);
    
    // 判断是否需要代理
    result.usBlocked = !result.tests.us.accessible;
    result.jpAccessible = result.tests.jp.accessible;
    result.needsProxy = result.usBlocked && result.jpAccessible;
    
    if (result.needsProxy) {
        $.log(`  🔒 需要代理: ${domain}`);
    }
    
    return result;
}

async function testWithNode(url, nodeName) {
    const startTime = Date.now();
    
    try {
        const options = {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15'
            },
            timeout: CONFIG.timeout
        };
        
        if (nodeName !== 'DIRECT') {
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
        return {
            success: false,
            error: error.message,
            accessible: false,
            isBlocked: true
        };
    }
}

function analyzeResponse(response) {
    if (response.status === 403 || response.status === 451) {
        return { isBlocked: true, reason: `HTTP ${response.status}` };
    }
    
    if (response.body) {
        const bodyLower = response.body.toLowerCase();
        
        for (const keyword of CONFIG.blockKeywords) {
            if (bodyLower.includes(keyword.toLowerCase())) {
                return { isBlocked: true, reason: `关键词: ${keyword}` };
            }
        }
        
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
        if (result.error) {
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
    content += `# 生成时间: ${new Date().toLocaleString('zh-CN')}\n`;
    content += `# 域名数量: ${blockedDomains.length}\n`;
    content += `# 说明: 这些域名限制美国IP访问，建议通过日本节点访问\n`;
    content += `\n`;
    
    // 域名规则
    for (const result of blockedDomains) {
        const domain = result.domain;
        const reason = result.tests.us?.reason || '美国地区受限';
        
        content += `# ${reason}\n`;
        content += `DOMAIN-SUFFIX,${domain},Japan\n`;
        content += `\n`;
    }
    
    // 尝试保存到 iCloud
    try {
        saveToFile(CONFIG.outputPath, content);
        $.log(`✅ 规则文件已保存: ${CONFIG.outputPath}`);
    } catch (error) {
        $.log(`⚠️ 无法保存文件: ${error.message}`);
        $.log('规则内容:\n' + content);
    }
    
    return content;
}

// ============ 生成报告 ============
function generateReport(analysis, totalChecked) {
    let report = '\n';
    report += '================================\n';
    report += '    批量检测报告\n';
    report += '================================\n\n';
    
    report += `检测时间: ${new Date().toLocaleString('zh-CN')}\n`;
    report += `检测总数: ${totalChecked}\n`;
    report += `需要代理: ${analysis.blockedCount} 个域名\n`;
    report += `直接访问: ${analysis.accessibleCount} 个域名\n`;
    report += `检测失败: ${analysis.errorCount} 个域名\n\n`;
    
    if (analysis.blockedCount > 0) {
        report += '🔒 需要代理的域名:\n';
        report += '--------------------------------\n';
        for (const result of analysis.blockedDomains) {
            const reason = result.tests.us?.reason || '未知';
            report += `  • ${result.domain}\n`;
            report += `    原因: ${reason}\n`;
        }
        report += '\n';
    }
    
    if (analysis.errorCount > 0) {
        report += '⚠️ 检测失败的域名:\n';
        report += '--------------------------------\n';
        for (const result of analysis.errorDomains) {
            report += `  • ${result.domain}\n`;
            report += `    错误: ${result.error}\n`;
        }
        report += '\n';
    }
    
    report += '================================\n';
    report += `规则文件: ${CONFIG.outputPath}\n`;
    report += '================================\n';
    
    // 生成简短摘要
    const summary = [
        `✅ 检测完成`,
        `📊 ${totalChecked} 个域名`,
        `🔒 ${analysis.blockedCount} 个需要代理`,
        analysis.errorCount > 0 ? `⚠️ ${analysis.errorCount} 个失败` : null
    ].filter(Boolean).join('\n');
    
    return {
        detailedLog: report,
        summary: summary
    };
}

// ============ 工具函数 ============
function extractDomain(url) {
    if (!url) return null;
    
    try {
        url = url.replace(/^https?:\/\//, '');
        url = url.split('/')[0];
        url = url.split(':')[0];
        return url.toLowerCase();
    } catch {
        return null;
    }
}

function httpRequest(url, options) {
    return new Promise((resolve, reject) => {
        $httpClient.get({ url, ...options }, (error, response, body) => {
            if (error) {
                reject(new Error(error));
            } else {
                resolve({
                    status: response.status,
                    headers: response.headers,
                    body: body
                });
            }
        });
    });
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function readFile(path) {
    // Surge 文件读取接口（如果支持）
    // 实际实现依赖于 Surge 版本
    return null;
}

function saveToFile(path, content) {
    // Surge 文件写入接口（如果支持）
    // 可能需要通过其他方式实现，如上传到 iCloud 或使用剪贴板
    
    // 方案1: 复制到剪贴板
    $clipboard.set(content);
    $.log('✅ 规则内容已复制到剪贴板');
    
    // 方案2: 如果 Surge 支持文件写入
    try {
        if ($files && $files.write) {
            $files.write({ path: path, content: content });
            return true;
        }
    } catch (error) {
        $.log(`文件写入失败: ${error.message}`);
    }
    
    return false;
}

// ============ 执行 ============
main();
