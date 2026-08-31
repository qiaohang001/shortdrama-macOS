import React, { useState } from "react";
import { api, generateImage } from "../../dispatch-jobs.js";

export function CharacterManager({ project, update, log }) {
  const characters = project.materials?.characters || [];
  const [generatingCharId, setGeneratingCharId] = useState(null);

  // 从剧本中自动提取人物
  const analyzeCharacters = async () => {
    const script = project.script || "";
    const outline = project.outline?.synopsis || "";
    
    if (!script && !outline) {
      log("请先上传或创作剧本");
      return;
    }

    log("正在分析剧本提取人物...");
    try {
      const content = script || outline;
      const prompt = `你是一名短剧角色分析师。请从以下剧本内容中提取所有人物信息。

要求：
1. 提取所有有台词或重要动作的角色
2. 外貌描述要具体详细（年龄/性别/发型/脸型/五官/服装/体型/配饰），便于AI生图保持人物一致性
3. 性格用3-5个关键词概括
4. 只输出纯JSON，不要markdown代码块，不要解释

剧本内容：
${content.slice(0, 5000)}

输出JSON格式：
{
  "characters": [
    {
      "name": "角色姓名",
      "role": "身份/职业（如主角/反派/配角）",
      "personality": "性格特点（3-5个关键词，如高冷/腹黑/善良）",
      "appearance": "外貌描述（年龄/发型/脸型/五官/上衣/下装/鞋履/配饰/体型/表情神态，80-150字，要具体到能直接出图）"
    }
  ]
}`;

      const res = await api("/api/llm/chat", {
        method: "POST",
        body: JSON.stringify({
          messages: [{ role: "user", content: prompt }],
          
        })
      });

      const text = res.choices?.[0]?.message?.content || "{}";
      let parsed;
      try {
        const match = text.match(/\{[\s\S]*\}/);
        parsed = match ? JSON.parse(match[0]) : { characters: [] };
      } catch {
        parsed = { characters: [] };
      }

      const newCharacters = (parsed.characters || []).map((c, i) => ({
        id: `char_${Date.now()}_${i}`,
        name: c.name || `角色${i + 1}`,
        role: c.role || "",
        personality: c.personality || "",
        appearance: c.appearance || "",
        image: null,
        locked: false
      }));

      // 合并现有角色和新提取的角色
      const existingNames = new Set(characters.map(c => c.name));
      const uniqueNewChars = newCharacters.filter(c => !existingNames.has(c.name));
      
      const allCharacters = [...uniqueNewChars, ...characters];
      
      update({
        materials: { ...project.materials, characters: allCharacters },
        outline: { ...project.outline, characters: allCharacters }
      });

      log(`成功提取 ${uniqueNewChars.length} 个人物，共 ${allCharacters.length} 人`);
    } catch (err) {
      log("提取人物失败：" + err.message);
    }
  };

  // AI根据人物描述生成参考图
  const generateCharacterImage = async (char) => {
    if (generatingCharId) return;
    setGeneratingCharId(char.id);
    log(`正在为「${char.name}」生成人物参考图...`);
    try {
      const appearance = char.appearance || "";
      const personality = char.personality || "";
      const role = char.role || "";
      const prompt = `角色设定三视图，${char.name}，${role}，${appearance}，性格气质：${personality}。同一角色的三个视角并排展示：正面视图、侧面视图（左侧）、背面视图。全身像，自然站立姿势，双臂自然下垂，双脚与肩同宽。纯白色无背景背景，无阴影，无环境元素，纯净角色设定图。超高清细节，8K分辨率，服装纹理清晰，发型准确，体型一致，三个视角外貌完全统一。专业角色设定图风格，动漫/游戏原画品质。`;
      const res = await generateImage({ prompt, model: "Qwen-Image", size: "1536x1024", n: 1 });
      const imageUrl = res.image_url || res.url || (res.images && res.images[0]) || res.result_url;
      if (!imageUrl) throw new Error("未返回图片地址");
      update({
        materials: {
          ...project.materials,
          characters: characters.map(x => x.id === char.id ? { ...x, image: imageUrl } : x)
        }
      });
      log(`「${char.name}」参考图生成成功`);
    } catch (err) {
      log(`生成失败：${err.message}`);
    } finally {
      setGeneratingCharId(null);
    }
  };

  return (
    <div style={{ padding: 16, height: "100%", overflow: "auto", color: "var(--text)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>👤 人物管理</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button 
            style={{ padding: "8px 16px", border: "1px solid var(--border)", borderRadius: 6, background: "transparent", color: "var(--text)", cursor: "pointer", fontSize: 13 }}
            onClick={analyzeCharacters}
          >
            🤖 AI分析人物（1积分）
          </button>
          <button 
            style={{ padding: "8px 16px", border: "none", borderRadius: 6, background: "linear-gradient(135deg, #7A5CFF, #5CE1E6)", color: "#fff", cursor: "pointer", fontSize: 13 }}
            onClick={() => {
              const name = window.prompt("请输入角色姓名：");
              if (!name) return;
              const c = { id: "char_" + Date.now(), name, role: "", personality: "", appearance: "", image: null, locked: false };
              update({ materials: { ...project.materials, characters: [c, ...characters] } });
              log("新增角色：" + name);
            }}
          >
            + 新增角色
          </button>
        </div>
      </div>
      
      {characters.length === 0 && (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", border: "1px dashed var(--border)", borderRadius: 12 }}>
          暂无角色，点击「AI分析人物」或「新增角色」添加
        </div>
      )}
      
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
        {characters.map(c => (
          <div key={c.id} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 12, background: "var(--panel-2)" }}>
            <div style={{ width: "100%", height: 160, background: "var(--input-bg)", borderRadius: 8, marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 48 }}>
              {c.image ? <img src={c.image} alt={c.name} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 8 }} /> : "👤"}
            </div>
            <div style={{ fontWeight: 600 }}>{c.name}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{c.role || "未设定"}</div>
            {c.personality && <div style={{ fontSize: 10, color: "var(--text-secondary)", marginTop: 2 }}>性格：{c.personality}</div>}
            <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
              <button
                style={{ flex: 1, minWidth: "45%", padding: "4px 0", border: "1px solid #7A5CFF", borderRadius: 4, background: "rgba(122,92,255,0.15)", color: "#7A5CFF", fontSize: 11, cursor: generatingCharId === c.id ? "wait" : "pointer" }}
                onClick={() => generateCharacterImage(c)}
                disabled={generatingCharId === c.id}
              >
                {generatingCharId === c.id ? "生成中..." : "🤖 AI生成（3积分）"}
              </button>
              <button
                style={{ flex: 1, minWidth: "45%", padding: "4px 0", border: "1px solid var(--border)", borderRadius: 4, background: "transparent", color: "var(--text)", fontSize: 11, cursor: "pointer" }}
                onClick={() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.accept = "image/*";
                  input.onchange = (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                      const img = ev.target.result;
                      update({ materials: { ...project.materials, characters: characters.map(x => x.id === c.id ? { ...x, image: img } : x) } });
                      log(`已上传角色 ${c.name} 的参考图`);
                    };
                    reader.readAsDataURL(file);
                  };
                  input.click();
                }}
              >
                📷 上传图片
              </button>
              <button
                style={{ flex: 1, padding: "4px 0", border: "1px solid var(--border)", borderRadius: 4, background: "transparent", color: "var(--text)", fontSize: 11, cursor: "pointer" }}
                onClick={() => {
                  const url = window.prompt("或通过 URL 设置角色图片：");
                  if (url) update({ materials: { ...project.materials, characters: characters.map(x => x.id === c.id ? { ...x, image: url } : x) } });
                }}
              >
                🔗 URL 图片
              </button>
              <button
                style={{ flex: 1, padding: "4px 0", border: "1px solid var(--border)", borderRadius: 4, background: c.locked ? "rgba(122,92,255,0.3)" : "transparent", color: c.locked ? "#7A5CFF" : "var(--text)", fontSize: 11, cursor: "pointer" }} 
                onClick={() => {
                  update({ materials: { ...project.materials, characters: characters.map(x => x.id === c.id ? { ...x, locked: !x.locked } : x) } });
                  log(c.locked ? "已解锁角色" : "已锁定角色形象");
                }}
              >
                {c.locked ? "已锁定" : "锁定"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
