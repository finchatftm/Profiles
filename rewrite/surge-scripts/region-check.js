/**
 * region-check.js
 * Surge 单个域名地区限制检测脚本
 * 
 * 用法:
 * 1. 通过 Panel 面板触发
 * 2. 通过参数传递: &domain=xxx&nodes=xxx
 */

// ============ 配置区 ============
const CONFIG = {
    // 默认测试的节点列表（可通过参数覆盖）
    defaultNodes: [
        '🇺🇸US1',  // 替换为你实际的美国节点名称
        '🇯🇵JP3',  // 替换为你实际的日本节点名称
        'DIRECT'
    ],
    
    // 默认测试域名（可通过参数覆盖）
    defaultDomain: 'binance.com',
    
    // 超时设置（秒）
    timeout: 10,
    
    // 判断阻断的关键词
    blockKeywords: [
        'not available',
        'restricted',
        'access denied',
        'geo-block',
        'vpn detected',
        '地区限制',
        '不可用',
        'region',
        'country'
    ]
};

// ============ 主函数 ============
async function main() {
    try {
        // 安全地获取参数
        let domain = CONFIG.defaultDomain;
        let nodes = CONFIG.defaultNodes;
        
        // 尝试从 $argument 获取参数（如果存在）
        if (typeof $argument !== 'undefined' && $argument) {
            if ($argument.domain) {
                domain = $argument.domain;
            }
            if ($argument.nodes) {
                nodes = $argument.nodes.split(',').map(n => n.trim());
            }
        }
        
        console.log(`开始检测域名: ${domain}`);
        console.log(`测试节点: ${nodes.join(', ')}`);
        
        // 执行检测
        const results = await testDomain(domain, nodes);
        
        // 生成报告
        const report = generateReport(domain, results);
        
        // 输出结果
        console.log(report.text);
        
        // 显示通知
        $notification.post(
            '🔍 域名检测完成',
            `域名: ${domain}`,
            report.summary
        );
        
        // Panel 显示
        $done({
            title: '域名检测结果',
            content: report.panel,
            icon: report.needsProxy ? 'lock.shield' : 'checkmark.shield',
            'icon-color': report.needsProxy ? '#FF9500' : '#34C759'
        });
        
    } catch (error) {
        console.log(`❌ 错误: ${error.message}`);
        console.log(error.stack);
        $notification.post('域名检测失败', '', error.message);
        $done({
            title: '检测失败',
            content: error.message,
            icon: 'xmark.circle',
            'icon-color': '#FF3B30'
        });
    }
}

// ============ 检测函数 ============
async function testDomain(domain, nodes) {
    const url = `https://${domain}`;
    const results = [];
    
    for (const nodeName of nodes) {
        console.log(`测试节点: ${nodeName}`);
        
        const result = await testWithNode(url, nodeName);
        results.push({
            node: nodeName,
            ...result
        });
        
        // 避免请求过快
        await sleep(1000);
    }
    
    return results;
}

async function testWithNode(url, nodeName) {
    const startTime = Date.now();
    
    try {
        // 构建请求选项
        const options = {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9'
            },
            timeout: CONFIG.timeout
        };
        
        // 设置策略组（节点）
        if (nodeName !== 'DIRECT' && nodeName !== '直连') {
            options['policy-name'] = nodeName;
        }
        
        // 发送请求
        const response = await httpRequest(url, options);
        const duration = Date.now() - startTime;
        
        // 分析响应
        const analysis = analyzeResponse(response);
        
        return {
            success: true,
            statusCode: response.status,
            duration: duration,
            size: response.body ? response.body.length : 0,
            isBlocked: analysis.isBlocked,
            blockReason: analysis.reason,
            accessible: response.status === 200 && !analysis.isBlocked
        };
        
    } catch (error) {
        const duration = Date.now() - startTime;
        return {
            success: false,
            error: error.message,
            duration: duration,
            accessible: false,
            isBlocked: true,
            blockReason: '请求失败'
        };
    }
}

function analyzeResponse(response) {
    // 检查状态码
    if (response.status === 403) {
        return { isBlocked: true, reason: 'HTTP 403 Forbidden' };
    }
    
    if (response.status === 451) {
        return { isBlocked: true, reason: 'HTTP 451 Unavailable For Legal Reasons' };
    }
    
    if (response.status >= 400) {
        return { isBlocked: true, reason: `HTTP ${response.status}` };
    }
    
    // 检查响应内容
    if (response.body) {
        const bodyLower = response.body.toLowerCase();
        
        for (const keyword of CONFIG.blockKeywords) {
            if (bodyLower.includes(keyword.toLowerCase())) {
                return { isBlocked: true, reason: `包含关键词: ${keyword}` };
            }
        }
        
        // 检查响应大小（某些被阻止的页面内容很少）
        if (response.body.length < 500) {
            return { isBlocked: true, reason: '响应内容过小（可能被重定向或阻止）' };
        }
    }
    
    return { isBlocked: false, reason: null };
}

// ============ 报告生成 ============
function generateReport(domain, results) {
    let textReport = `\n========== 域名检测报告 ==========\n`;
    textReport += `域名: ${domain}\n`;
    textReport += `时间: ${new Date().toLocaleString('zh-CN', {timeZone: 'Asia/Shanghai'})}\n`;
    textReport += `====================================\n\n`;
    
    let panelReport = '';
    let needsProxy = false;
    let summaryParts = [];
    
    for (const result of results) {
        const icon = result.accessible ? '✅' : '❌';
        const status = result.accessible ? '可访问' : '受限';
        
        textReport += `${icon} ${result.node}\n`;
        textReport += `   状态: ${status}\n`;
        
        if (result.success) {
            textReport += `   HTTP: ${result.statusCode}\n`;
            textReport += `   耗时: ${result.duration}ms\n`;
            textReport += `   大小: ${formatBytes(result.size)}\n`;
            
            if (result.isBlocked) {
                textReport += `   原因: ${result.blockReason}\n`;
            }
        } else {
            textReport += `   错误: ${result.error}\n`;
        }
        
        textReport += `\n`;
        
        // Panel 简化显示
        panelReport += `${icon} ${result.node}: ${status}`;
        if (result.duration) {
            panelReport += ` (${result.duration}ms)`;
        }
        panelReport += `\n`;
        
        // 收集摘要信息
        summaryParts.push(`${result.node}:${status}`);
    }
    
    // 判断是否需要代理
    const usBlocked = results.find(r => 
        (r.node.includes('美国') || r.node.toLowerCase().includes('us')) && !r.accessible
    );
    const jpAccessible = results.find(r => 
        (r.node.includes('日本') || r.node.toLowerCase().includes('jp') || r.node.toLowerCase().includes('japan')) && r.accessible
    );
    needsProxy = usBlocked && jpAccessible;
    
    textReport += `====================================\n`;
    textReport += `结论: ${needsProxy ? '🔒 建议添加到代理规则' : '✓ 无需代理'}\n`;
    
    if (needsProxy) {
        textReport += `\n建议添加规则:\n`;
        textReport += `DOMAIN-SUFFIX,${domain},Japan\n`;
    }
    
    return {
        text: textReport,
        panel: panelReport,
        summary: summaryParts.join(' | '),
        needsProxy: needsProxy
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

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / 1048576).toFixed(2) + ' MB';
}

// ============ 执行 ============
main();
