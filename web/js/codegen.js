// Единый генератор кода (клиентская сторона).
// Здесь живёт вся кодогенерация проекта:
//   1) Codegen.generateAll(req) — сниппет одиночного запроса для «Моментального генератора» в модалке (8 вкладок).
//   2) Методы генерации полного бота из сценария подмешиваются в window.Scenario (см. конец файла).
// Раньше пункт (1) дублировался в backend/code_gen.py — теперь источник один.
(function () {
    "use strict";

    // ---------- вспомогательные ----------
    function buildQuery(params) {
        if (!params) return "";
        const parts = [];
        const enc = (s) => encodeURIComponent(String(s)).replace(/%5B/g, "[").replace(/%5D/g, "]");
        Object.keys(params).forEach(k => {
            const v = params[k];
            if (Array.isArray(v)) v.forEach(x => parts.push(enc(k) + "=" + enc(x)));
            else parts.push(enc(k) + "=" + enc(v));
        });
        return parts.join("&");
    }
    function fullUrl(url, params) {
        const q = buildQuery(params);
        if (!q) return url;
        return url + (url.includes("?") ? "&" : "?") + q;
    }
    function tokenFromHeaders(headers) {
        return ((headers || {})["Authorization"] || "").replace("Bearer ", "") || "YOUR_TOKEN";
    }
    // JSON с отступом, как в python json.dumps(indent=N, ensure_ascii=False)
    function j(obj, indent) {
        return JSON.stringify(obj || {}, null, indent);
    }
    const isWrite = (m) => ["POST", "PUT"].includes(m.toUpperCase());

    // ---------- генераторы одиночного запроса ----------
    function pythonRequests(url, method, params, headers, body) {
        const ps = params && Object.keys(params).length ? j(params, 4) : "{}";
        const hs = headers && Object.keys(headers).length ? j(headers, 4) : "{}";
        let code = `import requests\n\nurl = "${url}"\nheaders = ${hs}\nparams = ${ps}\n`;
        if (isWrite(method) && body) {
            code += `data = ${j(body, 4)}\n`;
            code += `\nresponse = requests.${method.toLowerCase()}(url, headers=headers, params=params, data=data)\n`;
        } else {
            code += `\nresponse = requests.${method.toLowerCase()}(url, headers=headers, params=params)\n`;
        }
        code += `if response.status_code == 200:\n    data = response.json()\n    print("Успешно:", data)\nelse:\n    print(f"Ошибка {response.status_code}: {response.text}")\n`;
        return code;
    }

    function pythonAiohttp(url, method, params, headers, body) {
        const sp = {};
        Object.keys(params || {}).forEach(k => {
            const v = params[k];
            sp[k] = Array.isArray(v) ? v.map(String) : String(v);
        });
        const ps = Object.keys(sp).length ? j(sp, 8).replace("{\n", "{\n    ") : "{}";
        const hs = headers && Object.keys(headers).length ? j(headers, 8).replace("{\n", "{\n    ") : "{}";
        let code = `import aiohttp\nimport asyncio\n\nasync def make_request():\n    url = "${url}"\n    headers = ${hs}\n    params = ${ps}\n`;
        let call = `session.${method.toLowerCase()}(url, headers=headers, params=params`;
        if (isWrite(method) && body) {
            code += `    data = ${j(body, 8).replace("{\n", "{\n    ")}\n`;
            call += ", json=data)";
        } else {
            call += ")";
        }
        code += `\n    async with aiohttp.ClientSession() as session:\n        async with ${call} as response:\n            if response.status == 200:\n                data = await response.json()\n                print("Успешно:", data)\n            else:\n                text = await response.text()\n                print(f"Ошибка {response.status}: {text}")\n\nasyncio.run(make_request())\n`;
        return code;
    }

    function jsFetch(url, method, params, headers, body) {
        const hs = headers && Object.keys(headers).length ? j(headers, 4) : "{}";
        let code = `const url = new URL("${url}");\n`;
        if (params && Object.keys(params).length) {
            code += `const params = ${j(params, 4)};\nObject.entries(params).forEach(([key, value]) => {\n    if (Array.isArray(value)) {\n        value.forEach(v => url.searchParams.append(key, v));\n    } else {\n        url.searchParams.append(key, value);\n    }\n});\n`;
        }
        code += `\nfetch(url, {\n    method: "${method.toUpperCase()}",\n    headers: ${hs}`;
        if (isWrite(method) && body) code += `,\n    body: JSON.stringify(${j(body, 4)})`;
        code += `\n})\n.then(response => response.json())\n.then(data => console.log("Ответ:", data))\n.catch(error => console.error("Ошибка:", error));\n`;
        return code;
    }

    function jsAxios(url, method, params, headers, body) {
        const hs = headers && Object.keys(headers).length ? j(headers, 4) : "{}";
        const fu = fullUrl(url, params);
        let code = `const axios = require('axios');\n\nconst url = "${fu}";\nconst headers = ${hs};\n`;
        if (isWrite(method)) {
            if (body) {
                code += `const data = ${j(body, 4)};\n`;
                code += `\naxios.${method.toLowerCase()}(url, data, { headers })\n`;
            } else {
                code += `\naxios.${method.toLowerCase()}(url, null, { headers })\n`;
            }
        } else {
            code += `\naxios.${method.toLowerCase()}(url, { headers })\n`;
        }
        code += `    .then(response => {\n        console.log("Ответ:", response.data);\n    })\n    .catch(error => {\n        console.error("Ошибка:", error.response ? error.response.data : error.message);\n    });\n`;
        return code;
    }

    function curl(url, method, params, headers, body) {
        const fu = fullUrl(url, params);
        const lines = [`curl -X ${method.toUpperCase()} "${fu}"`];
        const hasAccept = Object.keys(headers || {}).some(k => k.toLowerCase() === "accept");
        Object.keys(headers || {}).forEach(k => lines.push(`  -H "${k}: ${headers[k]}"`));
        if (!hasAccept) lines.push('  -H "Accept: application/json"');
        if (isWrite(method) && body) {
            lines.push('  -H "Content-Type: application/json"');
            lines.push(`  -d '${JSON.stringify(body)}'`);
        }
        return lines.join(" \\\n") + "\n";
    }

    function csharp(url, method, params, headers, body) {
        const token = tokenFromHeaders(headers);
        const fu = fullUrl(url, params);
        let bodyBlock = "";
        if (isWrite(method) && body) {
            const bj = JSON.stringify(body).replace(/"/g, '\\"');
            bodyBlock = `        request.Content = new StringContent("${bj}", Encoding.UTF8, "application/json");\n`;
        }
        return `using System;\nusing System.Net.Http;\nusing System.Net.Http.Headers;\nusing System.Text;\nusing System.Threading.Tasks;\n\nclass Program {\n    static async Task Main() {\n        using var client = new HttpClient();\n        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", "${token}");\n        client.DefaultRequestHeaders.Add("User-Agent", "LZT-API-Constructor");\n\n        var request = new HttpRequestMessage(new HttpMethod("${method.toUpperCase()}"), "${fu}");\n${bodyBlock}\n        HttpResponseMessage response = await client.SendAsync(request);\n        string result = await response.Content.ReadAsStringAsync();\n        Console.WriteLine($"Status: {response.StatusCode}\\nResult: {result}");\n    }\n}\n`;
    }

    function php(url, method, params, headers, body) {
        const token = tokenFromHeaders(headers);
        const fu = fullUrl(url, params);
        let bodyBlock = "", contentType = "";
        if (isWrite(method) && body) {
            const bj = JSON.stringify(body).replace(/'/g, "\\'");
            bodyBlock = `curl_setopt($ch, CURLOPT_POSTFIELDS, '${bj}');\n`;
            contentType = '    "Content-Type: application/json",\n';
        }
        return `<?php\n$url = "${fu}";\n$ch = curl_init($url);\n\ncurl_setopt($ch, CURLOPT_RETURNTRANSFER, true);\ncurl_setopt($ch, CURLOPT_CUSTOMREQUEST, "${method.toUpperCase()}");\n${bodyBlock}curl_setopt($ch, CURLOPT_HTTPHEADER, [\n    "Authorization: Bearer ${token}",\n${contentType}    "Accept: application/json"\n]);\n\n$response = curl_exec($ch);\n$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);\ncurl_close($ch);\n\nif ($httpCode === 200) {\n    echo "Успешно: " . $response;\n} else {\n    echo "Ошибка ($httpCode): " . $response;\n}\n?>\n`;
    }

    function go(url, method, params, headers, body) {
        const token = tokenFromHeaders(headers);
        const fu = fullUrl(url, params);
        const imports = ['\t"fmt"', '\t"io"', '\t"net/http"'];
        let bodyArg = "nil", bodyBlock = "", ctLine = "";
        if (isWrite(method) && body) {
            imports.unshift('\t"bytes"');
            const bj = JSON.stringify(body).replace(/`/g, "'");
            bodyBlock = `\tpayload := bytes.NewBufferString(\`${bj}\`)\n`;
            bodyArg = "payload";
            ctLine = '\treq.Header.Add("Content-Type", "application/json")\n';
        }
        return `package main\n\nimport (\n${imports.join("\n")}\n)\n\nfunc main() {\n${bodyBlock}\treq, _ := http.NewRequest("${method.toUpperCase()}", "${fu}", ${bodyArg})\n\treq.Header.Add("Authorization", "Bearer ${token}")\n\treq.Header.Add("Accept", "application/json")\n${ctLine}\n\tclient := &http.Client{}\n\tresp, err := client.Do(req)\n\tif err != nil {\n\t\tfmt.Println("Ошибка запроса:", err)\n\t\treturn\n\t}\n\tdefer resp.Body.Close()\n\n\tbody, _ := io.ReadAll(resp.Body)\n\tfmt.Printf("Статус: %s\\nОтвет: %s\\n", resp.Status, string(body))\n}\n`;
    }

    function generateAll(req) {
        const { url = "", method = "GET", params = {}, headers = {}, body = null } = req || {};
        return {
            python_requests: pythonRequests(url, method, params, headers, body),
            python_aiohttp: pythonAiohttp(url, method, params, headers, body),
            js_fetch: jsFetch(url, method, params, headers, body),
            js_axios: jsAxios(url, method, params, headers, body),
            curl: curl(url, method, params, headers, body),
            csharp: csharp(url, method, params, headers, body),
            php: php(url, method, params, headers, body),
            go: go(url, method, params, headers, body),
        };
    }

    window.Codegen = { generateAll, buildQuery, fullUrl, tokenFromHeaders };
})();
