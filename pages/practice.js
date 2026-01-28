import { useCallback, useEffect, useRef, useState } from 'react';

import Head from 'next/head';
import { useRouter } from 'next/router';

// MUI Components
import {
    Alert,
    AppBar,
    Avatar,
    Box,
    Button,
    Card,
    CardContent,
    CircularProgress,
    Container,
    FormControl,
    Grid,
    IconButton,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    Snackbar,
    TextField,
    Toolbar,
    Tooltip,
    Typography,
    useTheme
} from '@mui/material';

// MUI Icons
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import PersonIcon from '@mui/icons-material/Person';
import RecordVoiceOverIcon from '@mui/icons-material/RecordVoiceOver';
import SendIcon from '@mui/icons-material/Send';
import SettingsIcon from '@mui/icons-material/Settings';
import StopIcon from '@mui/icons-material/Stop';

// Third-party Libraries
import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';
import OpenAI from 'openai';
import ReactMarkdown from 'react-markdown';
import ScrollToBottom from 'react-scroll-to-bottom';

// Local Imports
import SettingsDialog from '../components/SettingsDialog';
import { getConfig } from '../utils/config';

const interviewTypes = [
    { value: 'general', label: '一般面接（一次・二次面接）' },
    { value: 'technical', label: '技術面接' },
    { value: 'final', label: '最終面接（役員面接）' },
    { value: 'group', label: 'グループ面接' },
];

const interviewerStyles = [
    { value: 'friendly', label: '優しめ' },
    { value: 'standard', label: '標準' },
    { value: 'strict', label: '厳しめ' },
];

export default function PracticePage() {
    const theme = useTheme();
    const router = useRouter();

    const [appConfig, setAppConfig] = useState(getConfig());
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [snackbarOpen, setSnackbarOpen] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');
    const [snackbarSeverity, setSnackbarSeverity] = useState('info');

    // Practice mode states
    const [isInterviewStarted, setIsInterviewStarted] = useState(false);
    const [selectedInterviewType, setSelectedInterviewType] = useState('general');
    const [selectedInterviewerStyle, setSelectedInterviewerStyle] = useState('standard');
    const [messages, setMessages] = useState([]);
    const [userInput, setUserInput] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [streamingResponse, setStreamingResponse] = useState('');
    const [openAI, setOpenAI] = useState(null);
    const [isAILoading, setIsAILoading] = useState(true);

    // Microphone states
    const [isMicrophoneActive, setIsMicrophoneActive] = useState(false);
    const [micRecognizer, setMicRecognizer] = useState(null);
    const micInterimTranscription = useRef('');
    const finalTranscript = useRef('');

    const showSnackbar = useCallback((message, severity = 'info') => {
        setSnackbarMessage(message);
        setSnackbarSeverity(severity);
        setSnackbarOpen(true);
    }, []);

    const handleSettingsSaved = () => {
        const newConfig = getConfig();
        setAppConfig(newConfig);
        setIsAILoading(true);
    };

    // Initialize AI client
    useEffect(() => {
        const currentConfig = appConfig;
        const initializeAI = () => {
            try {
                if (currentConfig.aiModel.startsWith('gemini')) {
                    if (!currentConfig.geminiKey) {
                        showSnackbar('Gemini API key required. Please set it in Settings.', 'error');
                        setOpenAI(null);
                        return;
                    }
                    // Gemini uses API routes, just mark as ready
                    setOpenAI({ type: 'gemini' });
                } else {
                    if (!currentConfig.openaiKey) {
                        showSnackbar('OpenAI API key required. Please set it in Settings.', 'error');
                        setOpenAI(null);
                        return;
                    }
                    const openaiClient = new OpenAI({
                        apiKey: currentConfig.openaiKey,
                        dangerouslyAllowBrowser: true
                    });
                    setOpenAI(openaiClient);
                }
            } catch (error) {
                console.error('Error initializing AI client:', error);
                showSnackbar('Error initializing AI client: ' + error.message, 'error');
                setOpenAI(null);
            } finally {
                setIsAILoading(false);
            }
        };
        if (isAILoading) initializeAI();
    }, [appConfig, isAILoading, showSnackbar]);

    const handleSnackbarClose = () => setSnackbarOpen(false);

    // Build system prompt based on interview type and style
    const buildSystemPrompt = () => {
        const currentConfig = getConfig();
        let basePrompt = currentConfig.practiceSystemPrompt;

        // Add interview type context
        const typeContext = {
            general: '一般的な採用面接を行っています。志望動機、自己PR、学生時代に力を入れたことなどを中心に質問してください。',
            technical: '技術面接を行っています。技術的なスキル、問題解決能力、プロジェクト経験について深掘りしてください。',
            final: '役員による最終面接を行っています。入社意欲、キャリアビジョン、人物像を重点的に確認してください。',
            group: 'グループ面接を行っています。他の候補者との協調性や差別化を意識した質問をしてください。',
        };

        // Add interviewer style context
        const styleContext = {
            friendly: '優しく親しみやすい態度で接し、候補者がリラックスできるよう配慮してください。',
            standard: 'プロフェッショナルで中立的な態度で面接を進めてください。',
            strict: '厳しめの態度で、回答の論理性や具体性を深く追及してください。圧迫面接ではありませんが、高い基準で評価してください。',
        };

        basePrompt += `\n\n【面接の種類】\n${typeContext[selectedInterviewType]}`;
        basePrompt += `\n\n【面接官のスタイル】\n${styleContext[selectedInterviewerStyle]}`;

        // Add company and ES info if available
        if (currentConfig.companyName || currentConfig.companyInfo) {
            basePrompt += `\n\n---面接先企業情報---`;
            if (currentConfig.companyName && currentConfig.companyName.trim()) {
                basePrompt += `\n企業名: ${currentConfig.companyName}`;
            }
            if (currentConfig.companyInfo && currentConfig.companyInfo.trim()) {
                basePrompt += `\n\n${currentConfig.companyInfo}`;
            }
            basePrompt += `\n\nこの企業の面接官として質問してください。`;
        }

        if (currentConfig.esContent && currentConfig.esContent.trim()) {
            basePrompt += `\n\n---応募者のES（エントリーシート）情報---\n以下は応募者が提出したESの内容です。この情報を元に深掘り質問をしてください。\n\n${currentConfig.esContent}`;
        }

        return basePrompt;
    };

    // Send message to AI
    const sendMessageToAI = async (userMessage, isStarting = false) => {
        if (!openAI || isAILoading) {
            showSnackbar('AI client is not ready. Please wait or check settings.', 'warning');
            return;
        }

        setIsProcessing(true);
        const currentConfig = getConfig();
        const systemPrompt = buildSystemPrompt();

        // Add user message to history (unless starting)
        let updatedMessages = [...messages];
        if (!isStarting && userMessage) {
            const userMsg = { role: 'user', content: userMessage, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
            updatedMessages = [...messages, userMsg];
            setMessages(updatedMessages);
        }

        // Initialize streaming response
        setStreamingResponse('');

        try {
            let responseText = '';

            if (currentConfig.aiModel.startsWith('gemini')) {
                // Build chat history for API
                let chatHistory = [];

                if (!isStarting && updatedMessages.length > 0) {
                    // Add a synthetic user message at the start if history begins with assistant
                    if (updatedMessages[0].role === 'assistant') {
                        chatHistory.push({
                            role: 'user',
                            content: '面接を開始してください。'
                        });
                    }

                    // Add all messages, ensuring no consecutive same-role messages
                    for (const msg of updatedMessages) {
                        const role = msg.role === 'user' ? 'user' : 'assistant';
                        const lastEntry = chatHistory[chatHistory.length - 1];

                        if (lastEntry && lastEntry.role === role) {
                            // Merge consecutive same-role messages
                            lastEntry.content += '\n\n' + msg.content;
                        } else {
                            chatHistory.push({
                                role: role,
                                content: msg.content
                            });
                        }
                    }
                }

                const prompt = isStarting ? '面接を開始してください。' : userMessage;

                // デバッグ用: API入力をコンソールに出力
                console.log('=== Practice Mode - Gemini API Request (via API Route) ===');
                console.log('Model:', currentConfig.aiModel);
                console.log('--- System Prompt ---');
                console.log(systemPrompt);
                console.log('--- Chat History ---');
                console.log(JSON.stringify(chatHistory, null, 2));
                console.log('--- Current Prompt ---');
                console.log(prompt);
                console.log('==========================================');

                // Use API route for Gemini
                const response = await fetch('/api/chat/gemini', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        messages: chatHistory,
                        systemPrompt: systemPrompt,
                        model: currentConfig.aiModel,
                        temperature: 0.7,
                        maxOutputTokens: 500,
                        apiKey: currentConfig.geminiKey,
                        userMessage: prompt,
                        thinkingLevel: currentConfig.geminiThinkingLevel || 'auto'
                    })
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.error || `HTTP error: ${response.status}`);
                }

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const data = line.slice(6);
                            if (data === '[DONE]') break;

                            try {
                                const parsed = JSON.parse(data);
                                if (parsed.error) {
                                    throw new Error(parsed.error);
                                }
                                if (parsed.content) {
                                    responseText += parsed.content;
                                    setStreamingResponse(responseText);
                                }
                            } catch (parseError) {
                                if (data !== '' && !data.startsWith('[DONE]')) {
                                    console.warn('Failed to parse SSE data:', data);
                                }
                            }
                        }
                    }
                }
            } else {
                const apiMessages = [
                    { role: 'system', content: systemPrompt },
                    ...updatedMessages.map(msg => ({
                        role: msg.role,
                        content: msg.content
                    }))
                ];

                if (isStarting) {
                    apiMessages.push({ role: 'user', content: '面接を開始してください。' });
                }

                // デバッグ用: API入力をコンソールに出力
                console.log('=== Practice Mode - OpenAI API Request ===');
                console.log('Model:', currentConfig.aiModel);
                console.log('--- Messages ---');
                console.log(JSON.stringify(apiMessages, null, 2));
                console.log('==========================================');

                // Use streaming for OpenAI
                const stream = await openAI.chat.completions.create({
                    model: currentConfig.aiModel,
                    messages: apiMessages,
                    temperature: 0.7,
                    max_tokens: 500,
                    stream: true,
                });
                for await (const chunk of stream) {
                    const chunkText = chunk.choices[0]?.delta?.content || '';
                    responseText += chunkText;
                    setStreamingResponse(responseText);
                }
            }

            const assistantMsg = {
                role: 'assistant',
                content: responseText,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };

            if (isStarting) {
                setMessages([assistantMsg]);
            } else {
                setMessages(prev => [...prev, assistantMsg]);
            }
            setStreamingResponse('');

        } catch (error) {
            console.error('AI request error:', error);
            showSnackbar(`AI request failed: ${error.message}`, 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    // Start interview
    const handleStartInterview = async () => {
        setIsInterviewStarted(true);
        setMessages([]);
        await sendMessageToAI('', true);
    };

    // Send user response
    const handleSendMessage = async () => {
        if (!userInput.trim()) return;
        const message = userInput;
        setUserInput('');
        finalTranscript.current = '';
        await sendMessageToAI(message);
    };

    // Handle key press
    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    // End interview
    const handleEndInterview = async () => {
        await sendMessageToAI('面接を終了してください。これまでの私の回答について、良かった点と改善点をフィードバックしてください。');
    };

    // Reset interview
    const handleResetInterview = () => {
        setIsInterviewStarted(false);
        setMessages([]);
        setUserInput('');
        finalTranscript.current = '';
    };

    // Microphone functions
    const stopMicRecording = async () => {
        if (micRecognizer && typeof micRecognizer.stopContinuousRecognitionAsync === 'function') {
            try {
                await micRecognizer.stopContinuousRecognitionAsync();
                if (micRecognizer.audioConfig && micRecognizer.audioConfig.privSource && micRecognizer.audioConfig.privSource.privStream) {
                    const stream = micRecognizer.audioConfig.privSource.privStream;
                    if (stream instanceof MediaStream) {
                        stream.getTracks().forEach(track => track.stop());
                    }
                }
                if (micRecognizer.audioConfig && typeof micRecognizer.audioConfig.close === 'function') {
                    micRecognizer.audioConfig.close();
                }
            } catch (error) {
                console.error('Error stopping microphone recognition:', error);
            } finally {
                setIsMicrophoneActive(false);
                setMicRecognizer(null);
            }
        }
    };

    const startMicrophoneRecognition = async () => {
        if (isMicrophoneActive) {
            await stopMicRecording();
            return;
        }

        const currentConfig = getConfig();
        if (!currentConfig.azureToken || !currentConfig.azureRegion) {
            showSnackbar('Azure Speech credentials missing. Please set them in Settings.', 'error');
            return;
        }

        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            if (micRecognizer) await stopMicRecording();

            const audioConfig = SpeechSDK.AudioConfig.fromStreamInput(mediaStream);
            const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(currentConfig.azureToken, currentConfig.azureRegion);
            speechConfig.speechRecognitionLanguage = currentConfig.azureLanguage;

            const recognizer = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);

            recognizer.recognizing = (s, e) => {
                if (e.result.reason === SpeechSDK.ResultReason.RecognizingSpeech) {
                    micInterimTranscription.current = e.result.text;
                    setUserInput(finalTranscript.current + e.result.text);
                }
            };

            recognizer.recognized = (s, e) => {
                if (e.result.reason === SpeechSDK.ResultReason.RecognizedSpeech && e.result.text) {
                    micInterimTranscription.current = '';
                    finalTranscript.current += e.result.text.replace(/\s+/g, ' ').trim() + ' ';
                    setUserInput(finalTranscript.current);
                }
            };

            recognizer.canceled = (s, e) => {
                console.log(`CANCELED: Reason=${e.reason}`);
                if (e.reason === SpeechSDK.CancellationReason.Error) {
                    showSnackbar(`Speech recognition error: ${e.errorDetails}`, 'error');
                }
                stopMicRecording();
            };

            recognizer.sessionStopped = () => {
                stopMicRecording();
            };

            await recognizer.startContinuousRecognitionAsync();
            setMicRecognizer(recognizer);
            setIsMicrophoneActive(true);
            showSnackbar('Microphone recording started.', 'success');

        } catch (error) {
            console.error('Microphone capture error:', error);
            showSnackbar(`Failed to access microphone: ${error.message}`, 'error');
            setIsMicrophoneActive(false);
        }
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (micRecognizer) {
                stopMicRecording();
            }
        };
    }, []);

    // Render message
    const renderMessage = (message, index) => {
        const isUser = message.role === 'user';
        const Icon = isUser ? PersonIcon : RecordVoiceOverIcon;
        const title = isUser ? 'あなた' : '面接官';
        const avatarBgColor = isUser ? theme.palette.success.light : theme.palette.info.light;

        return (
            <Box
                key={index}
                sx={{
                    display: 'flex',
                    flexDirection: isUser ? 'row-reverse' : 'row',
                    mb: 2,
                    alignItems: 'flex-start'
                }}
            >
                <Avatar sx={{ bgcolor: avatarBgColor, mx: 1.5, mt: 0.5 }}>
                    <Icon sx={{ color: theme.palette.getContrastText(avatarBgColor) }} />
                </Avatar>
                <Paper
                    variant="outlined"
                    sx={{
                        p: 2,
                        maxWidth: '70%',
                        bgcolor: isUser ? theme.palette.success.light + '20' : theme.palette.background.default,
                        borderColor: isUser ? theme.palette.success.main : theme.palette.divider,
                    }}
                >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                        <Typography variant="subtitle2" fontWeight="bold">{title}</Typography>
                        <Typography variant="caption" color="text.secondary">{message.timestamp}</Typography>
                    </Box>
                    <ReactMarkdown
                        components={{
                            p: ({ node, ...props }) => <Typography paragraph {...props} sx={{ mb: 1, fontSize: '0.95rem' }} />,
                        }}
                    >
                        {message.content}
                    </ReactMarkdown>
                </Paper>
            </Box>
        );
    };

    return (
        <>
            <Head>
                <title>面接練習モード - Interview Copilot</title>
            </Head>
            <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
                <AppBar position="static" color="default" elevation={1}>
                    <Toolbar>
                        <Tooltip title="戻る">
                            <IconButton edge="start" color="inherit" onClick={() => router.push('/landing')} sx={{ mr: 2 }}>
                                <ArrowBackIcon />
                            </IconButton>
                        </Tooltip>
                        <RecordVoiceOverIcon sx={{ mr: 2, color: 'secondary.main' }} />
                        <Typography variant="h6" component="div" sx={{ flexGrow: 1, color: 'text.primary' }}>
                            面接練習モード
                        </Typography>
                        <Tooltip title="Settings">
                            <IconButton color="primary" onClick={() => setSettingsOpen(true)} aria-label="settings">
                                <SettingsIcon />
                            </IconButton>
                        </Tooltip>
                    </Toolbar>
                </AppBar>

                <Container maxWidth="md" sx={{ flexGrow: 1, py: 3, display: 'flex', flexDirection: 'column' }}>
                    {!isInterviewStarted ? (
                        // Start screen
                        <Card sx={{ maxWidth: 600, mx: 'auto', mt: 4 }}>
                            <CardContent sx={{ p: 4 }}>
                                <Typography variant="h5" gutterBottom align="center" sx={{ mb: 3 }}>
                                    🎤 面接練習を始めましょう
                                </Typography>
                                <Typography variant="body1" color="text.secondary" paragraph align="center">
                                    AIが面接官として質問します。実際の面接のように回答してください。
                                </Typography>

                                <FormControl fullWidth sx={{ mb: 3 }}>
                                    <InputLabel id="interview-type-label">面接の種類</InputLabel>
                                    <Select
                                        labelId="interview-type-label"
                                        value={selectedInterviewType}
                                        label="面接の種類"
                                        onChange={(e) => setSelectedInterviewType(e.target.value)}
                                    >
                                        {interviewTypes.map((type) => (
                                            <MenuItem key={type.value} value={type.value}>{type.label}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>

                                <FormControl fullWidth sx={{ mb: 4 }}>
                                    <InputLabel id="interviewer-style-label">面接官のスタイル</InputLabel>
                                    <Select
                                        labelId="interviewer-style-label"
                                        value={selectedInterviewerStyle}
                                        label="面接官のスタイル"
                                        onChange={(e) => setSelectedInterviewerStyle(e.target.value)}
                                    >
                                        {interviewerStyles.map((style) => (
                                            <MenuItem key={style.value} value={style.value}>{style.label}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>

                                <Button
                                    variant="contained"
                                    color="primary"
                                    size="large"
                                    fullWidth
                                    onClick={handleStartInterview}
                                    disabled={isAILoading || !openAI}
                                    startIcon={isAILoading ? <CircularProgress size={20} color="inherit" /> : <RecordVoiceOverIcon />}
                                >
                                    {isAILoading ? 'AI準備中...' : '面接を開始する'}
                                </Button>

                                {!openAI && !isAILoading && (
                                    <Alert severity="warning" sx={{ mt: 2 }}>
                                        設定からAPIキーを入力してください。
                                    </Alert>
                                )}
                            </CardContent>
                        </Card>
                    ) : (
                        // Interview in progress
                        <Card sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                            <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', p: 0 }}>
                                {/* Messages area */}
                                <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
                                    <ScrollToBottom className="scroll-to-bottom" followButtonClassName="hidden-follow-button">
                                        <Box sx={{ p: 2 }}>
                                            {messages.map(renderMessage)}
                                            {/* Show streaming response */}
                                            {isProcessing && streamingResponse && (
                                                <Box
                                                    sx={{
                                                        display: 'flex',
                                                        flexDirection: 'row',
                                                        mb: 2,
                                                        alignItems: 'flex-start'
                                                    }}
                                                >
                                                    <Avatar sx={{ bgcolor: theme.palette.info.light, mx: 1.5, mt: 0.5 }}>
                                                        <RecordVoiceOverIcon sx={{ color: theme.palette.getContrastText(theme.palette.info.light) }} />
                                                    </Avatar>
                                                    <Paper
                                                        variant="outlined"
                                                        sx={{
                                                            p: 2,
                                                            maxWidth: '70%',
                                                            bgcolor: theme.palette.background.default,
                                                            borderColor: theme.palette.divider,
                                                        }}
                                                    >
                                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                                                            <Typography variant="subtitle2" fontWeight="bold">面接官</Typography>
                                                            <CircularProgress size={14} sx={{ ml: 1 }} />
                                                        </Box>
                                                        <ReactMarkdown
                                                            components={{
                                                                p: ({ node, ...props }) => <Typography paragraph {...props} sx={{ mb: 1, fontSize: '0.95rem' }} />,
                                                            }}
                                                        >
                                                            {streamingResponse}
                                                        </ReactMarkdown>
                                                    </Paper>
                                                </Box>
                                            )}
                                            {/* Show loading indicator when no streaming content yet */}
                                            {isProcessing && !streamingResponse && (
                                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 2 }}>
                                                    <CircularProgress size={24} />
                                                    <Typography variant="caption" sx={{ ml: 1 }}>面接官が考えています...</Typography>
                                                </Box>
                                            )}
                                        </Box>
                                    </ScrollToBottom>
                                </Box>

                                {/* Input area */}
                                <Box sx={{ p: 2, borderTop: `1px solid ${theme.palette.divider}`, bgcolor: theme.palette.background.paper }}>
                                    <Grid container spacing={1} alignItems="flex-end">
                                        <Grid item xs>
                                            <TextField
                                                fullWidth
                                                multiline
                                                maxRows={4}
                                                variant="outlined"
                                                placeholder="回答を入力してください..."
                                                value={userInput}
                                                onChange={(e) => setUserInput(e.target.value)}
                                                onKeyDown={handleKeyPress}
                                                disabled={isProcessing}
                                            />
                                        </Grid>
                                        <Grid item>
                                            <Tooltip title={isMicrophoneActive ? 'マイク停止' : 'マイクで回答'}>
                                                <IconButton
                                                    color={isMicrophoneActive ? 'error' : 'primary'}
                                                    onClick={startMicrophoneRecognition}
                                                    disabled={isProcessing}
                                                >
                                                    {isMicrophoneActive ? <MicOffIcon /> : <MicIcon />}
                                                </IconButton>
                                            </Tooltip>
                                        </Grid>
                                        <Grid item>
                                            <Tooltip title="送信">
                                                <IconButton
                                                    color="primary"
                                                    onClick={handleSendMessage}
                                                    disabled={isProcessing || !userInput.trim()}
                                                >
                                                    <SendIcon />
                                                </IconButton>
                                            </Tooltip>
                                        </Grid>
                                    </Grid>
                                    <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                                        <Button
                                            variant="outlined"
                                            color="warning"
                                            onClick={handleEndInterview}
                                            disabled={isProcessing}
                                            startIcon={<StopIcon />}
                                        >
                                            面接を終了してフィードバックをもらう
                                        </Button>
                                        <Button
                                            variant="outlined"
                                            color="inherit"
                                            onClick={handleResetInterview}
                                            disabled={isProcessing}
                                        >
                                            最初からやり直す
                                        </Button>
                                    </Box>
                                </Box>
                            </CardContent>
                        </Card>
                    )}
                </Container>

                <SettingsDialog
                    open={settingsOpen}
                    onClose={() => setSettingsOpen(false)}
                    onSave={handleSettingsSaved}
                />
                <Snackbar
                    open={snackbarOpen}
                    autoHideDuration={4000}
                    onClose={handleSnackbarClose}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                >
                    <Alert onClose={handleSnackbarClose} severity={snackbarSeverity} sx={{ width: '100%', boxShadow: theme.shadows[6] }}>
                        {snackbarMessage}
                    </Alert>
                </Snackbar>
            </Box>
            <style jsx global>{`
        .scroll-to-bottom {
          height: 100%;
          width: 100%;
          overflow-y: auto;
        }
        .hidden-follow-button {
          display: none;
        }
        .scroll-to-bottom::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .scroll-to-bottom::-webkit-scrollbar-track {
          background: ${theme.palette.background.paper};
          border-radius: 10px;
        }
        .scroll-to-bottom::-webkit-scrollbar-thumb {
          background-color: ${theme.palette.grey[400]};
          border-radius: 10px;
          border: 2px solid ${theme.palette.background.paper};
        }
        .scroll-to-bottom::-webkit-scrollbar-thumb:hover {
          background-color: ${theme.palette.grey[500]};
        }
        .scroll-to-bottom {
          scrollbar-width: thin;
          scrollbar-color: ${theme.palette.grey[400]} ${theme.palette.background.paper};
        }
      `}</style>
        </>
    );
}
