export const builtInModelGroups = [
  {
    name: "OpenAI Models",
    models: [
      { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" },
      { value: "gpt-4", label: "GPT-4" },
      { value: "gpt-4-turbo-preview", label: "GPT-4 Turbo Preview" },
      { value: "gpt-4o", label: "GPT-4o (Omni)" },
    ]
  },
  {
    name: "Gemini Models",
    models: [
      { value: "gemini-3-pro-preview", label: "Gemini 3 Pro Preview（最高性能）" },
      { value: "gemini-3-flash-preview", label: "Gemini 3 Flash Preview（高速）" },
      { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro（安定版・高性能）" },
      { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash（安定版・バランス）" },
      { value: "gemini-2.5-flash-preview-09-2025", label: "Gemini 2.5 Flash Preview" },
    ]
  }
];


const defaultConfig = {
  openaiKey: '',
  geminiKey: '',
  aiModel: 'gpt-3.5-turbo', // Default to a common one
  silenceTimerDuration: 1.2,
  responseLength: 'medium',
  companyName: '', // 面接先の企業名
  companyInfo: '', // 企業の業務内容・理念など
  esContent: '', // ES（エントリーシート）の内容を保存
  gptSystemPrompt: `あなたは日本の就職活動に詳しい面接コーチです。大学生が企業の新卒採用面接で使える回答例を提案してください。

回答は以下の点を意識してください：
- STAR法（状況・課題・行動・結果）を使って具体的なエピソードを含める
- 1〜2分で話せる適切な長さ（300〜400字程度）
- 敬語を使用し、ポジティブな印象を与える表現
- 「ガクチカ」「志望動機」「自己PR」など就活特有の質問に対応
- 論理的かつ簡潔で、面接官に伝わりやすい構成

質問のカテゴリに応じて適切なフォーマットで回答してください。`,
  azureToken: '',
  azureRegion: 'japaneast',
  azureLanguage: 'ja-JP',
  customModels: [], // Array for user-added models { value: 'model-id', label: 'Display Name', type: 'openai' | 'gemini' }
  systemAutoMode: true,
  isManualMode: false,
  // 面接練習モード用設定
  practiceInterviewType: 'general', // general, technical, final
  practiceInterviewerStyle: 'standard', // strict, friendly, standard
  practiceSystemPrompt: `あなたは日本の企業の採用面接官です。新卒採用の面接を行っています。

以下のルールに従ってください：
1. 一度に1つの質問だけを出してください
2. 質問は面接でよく聞かれる一般的な内容から始め、徐々に深掘りしてください
3. 候補者の回答に対して、適切なフォローアップ質問をしてください
4. 面接官として自然な日本語で会話してください
5. 回答の長さは2〜3文程度にしてください

候補者が「面接を終了」と言ったら、これまでの回答を総合的に評価し、良かった点と改善点をフィードバックしてください。

まずは挨拶と自己紹介を促すところから始めてください。`,
};

export function getConfig() {
  if (typeof window !== 'undefined') {
    const storedConfig = localStorage.getItem('interviewCopilotConfig');
    let parsed = storedConfig ? JSON.parse(storedConfig) : {};

    // Migrate old config format for aiModel if gptModel exists
    if (parsed.gptModel && !parsed.aiModel) {
      parsed.aiModel = parsed.gptModel;
      delete parsed.gptModel;
    }
    // Ensure customModels is an array
    if (!Array.isArray(parsed.customModels)) {
      parsed.customModels = [];
    }

    return { ...defaultConfig, ...parsed };
  }
  return defaultConfig;
}

export function setConfig(config) {
  if (typeof window !== 'undefined') {
    // Ensure customModels is an array before saving
    const configToSave = {
      ...config,
      customModels: Array.isArray(config.customModels) ? config.customModels : []
    };
    localStorage.setItem('interviewCopilotConfig', JSON.stringify(configToSave));
  }
}
