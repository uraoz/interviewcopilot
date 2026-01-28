import { useCallback, useEffect, useRef, useState } from 'react';

import Head from 'next/head';
import { useRouter } from 'next/router';
import { useDispatch, useSelector } from 'react-redux';

// MUI Components
import {
  Alert,
  AppBar,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Checkbox,
  Chip,
  CircularProgress,
  Container,
  Divider,
  FormControlLabel,
  Grid,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Paper,
  Snackbar,
  Switch,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
  useTheme
} from '@mui/material';

// MUI Icons
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import HearingIcon from '@mui/icons-material/Hearing';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import PersonIcon from '@mui/icons-material/Person';
import PictureInPictureAltIcon from '@mui/icons-material/PictureInPictureAlt';
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck';
import ScreenShareIcon from '@mui/icons-material/ScreenShare';
import SendIcon from '@mui/icons-material/Send';
import SettingsIcon from '@mui/icons-material/Settings';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import SpeakerNotesIcon from '@mui/icons-material/SpeakerNotes';
import StopScreenShareIcon from '@mui/icons-material/StopScreenShare';
import SwapVertIcon from '@mui/icons-material/SwapVert';

// Third-party Libraries
import { GoogleGenerativeAI } from '@google/generative-ai';
import hljs from 'highlight.js';
import 'highlight.js/styles/atom-one-dark.css';
import throttle from 'lodash.throttle';
import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';
import OpenAI from 'openai';
import ReactMarkdown from 'react-markdown';
import ScrollToBottom from 'react-scroll-to-bottom';

// Local Imports
import SettingsDialog from '../components/SettingsDialog';
import { setAIResponse } from '../redux/aiResponseSlice';
import { addToHistory } from '../redux/historySlice';
import { clearTranscription, setTranscription } from '../redux/transcriptionSlice';
import { getConfig, setConfig as saveConfig } from '../utils/config';



function debounce(func, timeout = 100) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      func.apply(this, args);
    }, timeout);
  };
}


export default function InterviewPage() {
  const dispatch = useDispatch();
  const transcriptionFromStore = useSelector(state => state.transcription);
  const aiResponseFromStore = useSelector(state => state.aiResponse);
  const history = useSelector(state => state.history);
  const theme = useTheme();

  const [appConfig, setAppConfig] = useState(getConfig());

  const [systemRecognizer, setSystemRecognizer] = useState(null);
  const [micRecognizer, setMicRecognizer] = useState(null);
  const [systemAutoMode, setSystemAutoMode] = useState(appConfig.systemAutoMode !== undefined ? appConfig.systemAutoMode : true);
  const [openAI, setOpenAI] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isMicrophoneActive, setIsMicrophoneActive] = useState(false);
  const [isSystemAudioActive, setIsSystemAudioActive] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('info');
  const [selectedQuestions, setSelectedQuestions] = useState([]);
  const [isManualMode, setIsManualMode] = useState(appConfig.isManualMode !== undefined ? appConfig.isManualMode : false);
  const [micTranscription, setMicTranscription] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAILoading, setIsAILoading] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);
  const [aiResponseSortOrder, setAiResponseSortOrder] = useState('newestAtTop');
  const [isPipWindowActive, setIsPipWindowActive] = useState(false);

  const pipWindowRef = useRef(null);
  const documentPipWindowRef = useRef(null);
  const documentPipIframeRef = useRef(null);
  const systemInterimTranscription = useRef('');
  const micInterimTranscription = useRef('');
  const silenceTimer = useRef(null);
  const finalTranscript = useRef({ system: '', microphone: '' });
  const isManualModeRef = useRef(isManualMode);
  const systemAutoModeRef = useRef(systemAutoMode);
  const throttledDispatchSetAIResponseRef = useRef(null);

  const showSnackbar = useCallback((message, severity = 'info') => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  }, []);

  const handleSettingsSaved = () => {
    const newConfig = getConfig();
    setAppConfig(newConfig);
    setIsAILoading(true);
    setSystemAutoMode(newConfig.systemAutoMode !== undefined ? newConfig.systemAutoMode : true);
    setIsManualMode(newConfig.isManualMode !== undefined ? newConfig.isManualMode : false);
  };

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
          const genAI = new GoogleGenerativeAI(currentConfig.geminiKey);
          setOpenAI(genAI);
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

  useEffect(() => { isManualModeRef.current = isManualMode; }, [isManualMode]);
  useEffect(() => { systemAutoModeRef.current = systemAutoMode; }, [systemAutoMode]);

  useEffect(() => {
    throttledDispatchSetAIResponseRef.current = throttle((payload) => {
      dispatch(setAIResponse(payload));
    }, 250, { leading: true, trailing: true });

    return () => {
      if (throttledDispatchSetAIResponseRef.current && typeof throttledDispatchSetAIResponseRef.current.cancel === 'function') {
        throttledDispatchSetAIResponseRef.current.cancel();
      }
    };
  }, [dispatch]);

  const handleSnackbarClose = () => setSnackbarOpen(false);

  const stopRecording = async (source) => {
    const recognizer = source === 'system' ? systemRecognizer : micRecognizer;
    if (recognizer && typeof recognizer.stopContinuousRecognitionAsync === 'function') {
      try {
        await recognizer.stopContinuousRecognitionAsync();
        if (recognizer.audioConfig && recognizer.audioConfig.privSource && recognizer.audioConfig.privSource.privStream) {
          const stream = recognizer.audioConfig.privSource.privStream;
          if (stream instanceof MediaStream) {
            stream.getTracks().forEach(track => {
              track.stop();
            });
          }
        }
        if (recognizer.audioConfig && typeof recognizer.audioConfig.close === 'function') {
          recognizer.audioConfig.close();
        }
      } catch (error) {
        console.error(`Error stopping ${source} recognition:`, error);
        showSnackbar(`Error stopping ${source} audio: ${error.message}`, 'error');
      } finally {
        if (source === 'system') {
          setIsSystemAudioActive(false);
          setSystemRecognizer(null);
        } else {
          setIsMicrophoneActive(false);
          setMicRecognizer(null);
        }
      }
    }
  };

  const handleClearSystemTranscription = () => {
    finalTranscript.current.system = '';
    systemInterimTranscription.current = '';
    dispatch(clearTranscription());
  };

  const handleClearMicTranscription = () => {
    finalTranscript.current.microphone = '';
    micInterimTranscription.current = '';
    setMicTranscription('');
  };

  const handleTranscriptionEvent = (text, source) => {
    const cleanText = text.replace(/\s+/g, ' ').trim();
    if (!cleanText) return;

    finalTranscript.current[source] += cleanText + ' ';

    if (source === 'system') {
      dispatch(setTranscription(finalTranscript.current.system + systemInterimTranscription.current));
    } else {
      setMicTranscription(finalTranscript.current.microphone + micInterimTranscription.current);
    }

    const currentConfig = getConfig();
    const currentSilenceTimerDuration = currentConfig.silenceTimerDuration;

    if ((source === 'system' && systemAutoModeRef.current) || (source === 'microphone' && !isManualModeRef.current)) {
      clearTimeout(silenceTimer.current);
      silenceTimer.current = setTimeout(() => {
        askOpenAI(finalTranscript.current[source].trim(), source);
      }, currentSilenceTimerDuration * 1000);
    }
  };

  const handleManualInputChange = (value, source) => {
    if (source === 'system') {
      dispatch(setTranscription(value));
      finalTranscript.current.system = value;
    } else {
      setMicTranscription(value);
      finalTranscript.current.microphone = value;
    }
  };

  const handleManualSubmit = (source) => {
    const textToSubmit = source === 'system' ? transcriptionFromStore : micTranscription;
    if (textToSubmit.trim()) {
      askOpenAI(textToSubmit.trim(), source);
    } else {
      showSnackbar('Input is empty.', 'warning');
    }
  };

  const handleKeyPress = (e, source) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleManualSubmit(source);
    }
  };

  const handleCombineAndSubmit = () => {
    if (selectedQuestions.length === 0) {
      showSnackbar('No questions selected to combine.', 'warning');
      return;
    }
    const questionHistory = history.filter(e => e.type === 'question').slice().reverse();
    const questionTexts = selectedQuestions.map(selectedIndexInReversedArray => {
      return questionHistory[selectedIndexInReversedArray]?.text;
    }).filter(text => text);

    if (questionTexts.length === 0) {
      showSnackbar('Could not retrieve selected question texts.', 'warning');
      return;
    }

    const combinedText = questionTexts.join('\n\n---\n\n');
    askOpenAI(combinedText, 'combined');
    setSelectedQuestions([]);
  };

  const createRecognizer = async (mediaStream, source) => {
    const currentConfig = getConfig();
    if (!currentConfig.azureToken || !currentConfig.azureRegion) {
      showSnackbar('Azure Speech credentials missing. Please set them in Settings.', 'error');
      mediaStream.getTracks().forEach(track => track.stop());
      return null;
    }

    let audioConfig;
    try {
      audioConfig = SpeechSDK.AudioConfig.fromStreamInput(mediaStream);
    } catch (configError) {
      console.error(`Error creating AudioConfig for ${source}:`, configError);
      showSnackbar(`Error setting up audio for ${source}: ${configError.message}`, 'error');
      mediaStream.getTracks().forEach(track => track.stop());
      return null;
    }

    const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(currentConfig.azureToken, currentConfig.azureRegion);
    speechConfig.speechRecognitionLanguage = currentConfig.azureLanguage;

    const recognizer = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);

    recognizer.recognizing = (s, e) => {
      if (e.result.reason === SpeechSDK.ResultReason.RecognizingSpeech) {
        const interimText = e.result.text;
        if (source === 'system') {
          systemInterimTranscription.current = interimText;
          dispatch(setTranscription(finalTranscript.current.system + interimText));
        } else {
          micInterimTranscription.current = interimText;
          setMicTranscription(finalTranscript.current.microphone + interimText);
        }
      }
    };

    recognizer.recognized = (s, e) => {
      if (e.result.reason === SpeechSDK.ResultReason.RecognizedSpeech && e.result.text) {
        if (source === 'system') systemInterimTranscription.current = '';
        else micInterimTranscription.current = '';
        handleTranscriptionEvent(e.result.text, source);
      } else if (e.result.reason === SpeechSDK.ResultReason.NoMatch) {
        // console.log(`NOMATCH: Speech could not be recognized for ${source}.`);
      }
    };

    recognizer.canceled = (s, e) => {
      console.log(`CANCELED: Reason=${e.reason} for ${source}`);
      if (e.reason === SpeechSDK.CancellationReason.Error) {
        console.error(`CANCELED: ErrorCode=${e.errorCode}`);
        console.error(`CANCELED: ErrorDetails=${e.errorDetails}`);
        showSnackbar(`Speech recognition error for ${source}: ${e.errorDetails}`, 'error');
      }
      stopRecording(source);
    };

    recognizer.sessionStopped = (s, e) => {
      console.log(`Session stopped event for ${source}.`);
      stopRecording(source);
    };

    try {
      await recognizer.startContinuousRecognitionAsync();
      return recognizer;
    } catch (error) {
      console.error(`Error starting ${source} continuous recognition:`, error);
      showSnackbar(`Failed to start ${source} recognition: ${error.message}`, 'error');
      if (audioConfig && typeof audioConfig.close === 'function') audioConfig.close();
      mediaStream.getTracks().forEach(track => track.stop());
      return null;
    }
  };

  const startSystemAudioRecognition = async () => {
    if (isSystemAudioActive) {
      await stopRecording('system');
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      showSnackbar('Screen sharing is not supported by your browser.', 'error');
      setIsSystemAudioActive(false);
      return;
    }

    try {
      const mediaStream = await navigator.mediaDevices.getDisplayMedia({
        audio: true,
        video: {
          displaySurface: 'browser',
          logicalSurface: true
        }
      });

      const audioTracks = mediaStream.getAudioTracks();
      if (audioTracks.length === 0) {
        showSnackbar('No audio track detected. Please ensure you share a tab with audio.', 'warning');
        mediaStream.getTracks().forEach(track => track.stop());
        return;
      }

      if (systemRecognizer) {
        await stopRecording('system');
      }

      const recognizerInstance = await createRecognizer(mediaStream, 'system');
      if (recognizerInstance) {
        setSystemRecognizer(recognizerInstance);
        setIsSystemAudioActive(true);
        showSnackbar('System audio recording started.', 'success');
        mediaStream.getTracks().forEach(track => {
          track.onended = () => {
            showSnackbar('Tab sharing ended.', 'info');
            stopRecording('system');
          };
        });
      } else {
        mediaStream.getTracks().forEach(track => track.stop());
      }
    } catch (error) {
      console.error('System audio capture error:', error);
      if (error.name === "NotAllowedError") {
        showSnackbar('Permission denied for screen recording. Please allow access.', 'error');
      } else if (error.name === "NotFoundError") {
        showSnackbar('No suitable tab/window found to share.', 'error');
      } else if (error.name === "NotSupportedError") {
        showSnackbar('System audio capture not supported by your browser.', 'error');
      } else {
        showSnackbar(`Failed to start system audio capture: ${error.message || 'Unknown error'}`, 'error');
      }
      setIsSystemAudioActive(false);
    }
  };

  const startMicrophoneRecognition = async () => {
    if (isMicrophoneActive) {
      await stopRecording('microphone');
      return;
    }
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (micRecognizer) await stopRecording('microphone');

      const recognizerInstance = await createRecognizer(mediaStream, 'microphone');
      if (recognizerInstance) {
        setMicRecognizer(recognizerInstance);
        setIsMicrophoneActive(true);
        showSnackbar('Microphone recording started.', 'success');
      } else {
        mediaStream.getTracks().forEach(track => track.stop());
      }
    } catch (error) {
      console.error('Microphone capture error:', error);
      if (error.name === "NotAllowedError" || error.name === "NotFoundError") {
        showSnackbar('Permission denied for microphone. Please allow access.', 'error');
      } else {
        showSnackbar(`Failed to access microphone: ${error.message || 'Unknown error'}`, 'error');
      }
      setIsMicrophoneActive(false);
    }
  };

  const askOpenAI = async (text, source) => {
    if (!text.trim()) {
      showSnackbar('No input text to process.', 'warning');
      return;
    }

    const currentConfig = getConfig();

    // Validate API key based on model
    if (currentConfig.aiModel.startsWith('gemini')) {
      if (!currentConfig.geminiKey) {
        showSnackbar('Gemini API key required. Please set it in Settings.', 'error');
        return;
      }
    } else {
      if (!currentConfig.openaiKey) {
        showSnackbar('OpenAI API key required. Please set it in Settings.', 'error');
        return;
      }
    }

    const lengthSettings = {
      concise: { temperature: 0.4, maxTokens: 500 },
      medium: { temperature: 0.5, maxTokens: 1000 },
      lengthy: { temperature: 0.6, maxTokens: 2000 }
    };
    const { temperature, maxTokens } = lengthSettings[currentConfig.responseLength || 'medium'];

    // 企業情報とESの内容をシステムプロンプトに追加
    let fullSystemPrompt = currentConfig.gptSystemPrompt;

    if (currentConfig.companyName || currentConfig.companyInfo) {
      fullSystemPrompt += `\n\n---面接先企業情報---`;
      if (currentConfig.companyName && currentConfig.companyName.trim()) {
        fullSystemPrompt += `\n企業名: ${currentConfig.companyName}`;
      }
      if (currentConfig.companyInfo && currentConfig.companyInfo.trim()) {
        fullSystemPrompt += `\n\n${currentConfig.companyInfo}`;
      }
      fullSystemPrompt += `\n\n回答時はこの企業の理念や事業内容に沿った内容を意識してください。`;
    }

    if (currentConfig.esContent && currentConfig.esContent.trim()) {
      fullSystemPrompt += `\n\n---応募者のES（エントリーシート）情報---\n以下は応募者が提出したESの内容です。回答時にこの情報を参考にして、一貫性のある回答を提案してください。\n\n${currentConfig.esContent}`;
    }

    setIsProcessing(true);
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    let streamedResponse = '';

    dispatch(addToHistory({ type: 'question', text, timestamp, source, status: 'pending' }));
    dispatch(setAIResponse(''));

    try {
      const conversationHistoryForAPI = history
        .filter(e => e.text && (e.type === 'question' || e.type === 'response') && e.status !== 'pending')
        .slice(-6)
        .map(event => ({
          role: event.type === 'question' ? 'user' : 'assistant',
          content: event.text,
        }));

      // デバッグ用: LLMに送信するプロンプトをコンソールに出力
      console.log('=== LLM Request Debug (via API Route) ===');
      console.log('Model:', currentConfig.aiModel);
      console.log('Temperature:', temperature);
      console.log('Max Tokens:', maxTokens);
      console.log('--- System Prompt ---');
      console.log(fullSystemPrompt);
      console.log('--- Conversation History ---');
      console.log(JSON.stringify(conversationHistoryForAPI, null, 2));
      console.log('--- User Input ---');
      console.log(text);
      console.log('=========================');

      const isGemini = currentConfig.aiModel.startsWith('gemini');
      const apiEndpoint = isGemini ? '/api/chat/gemini' : '/api/chat/openai';

      const requestBody = isGemini ? {
        messages: conversationHistoryForAPI,
        systemPrompt: fullSystemPrompt,
        model: currentConfig.aiModel,
        temperature,
        maxOutputTokens: maxTokens,
        apiKey: currentConfig.geminiKey,
        userMessage: text,
        thinkingLevel: currentConfig.geminiThinkingLevel || 'auto'
      } : {
        messages: [
          { role: 'system', content: fullSystemPrompt },
          ...conversationHistoryForAPI,
          { role: 'user', content: text }
        ],
        model: currentConfig.aiModel,
        temperature,
        max_tokens: maxTokens,
        apiKey: currentConfig.openaiKey
      };

      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
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

        // Keep the last incomplete line in the buffer
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
                streamedResponse += parsed.content;
                if (throttledDispatchSetAIResponseRef.current) {
                  throttledDispatchSetAIResponseRef.current(streamedResponse);
                }
              }
            } catch (parseError) {
              // Skip invalid JSON lines
              if (data !== '' && !data.startsWith('[DONE]')) {
                console.warn('Failed to parse SSE data:', data);
              }
            }
          }
        }
      }

      if (throttledDispatchSetAIResponseRef.current && typeof throttledDispatchSetAIResponseRef.current.cancel === 'function') {
        throttledDispatchSetAIResponseRef.current.cancel();
      }
      dispatch(setAIResponse(streamedResponse));

      const finalTimestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      dispatch(addToHistory({ type: 'response', text: streamedResponse, timestamp: finalTimestamp, status: 'completed' }));

    } catch (error) {
      console.error("AI request error:", error);
      const errorMessage = `AI request failed: ${error.message || 'Unknown error'}`;
      showSnackbar(errorMessage, 'error');
      dispatch(setAIResponse(`Error: ${errorMessage}`));
      dispatch(addToHistory({ type: 'response', text: `Error: ${errorMessage}`, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), status: 'error' }));
    } finally {
      if ((source === 'system' && systemAutoModeRef.current) || (source === 'microphone' && !isManualModeRef.current)) {
        finalTranscript.current[source] = '';
        if (source === 'system') {
          systemInterimTranscription.current = '';
          dispatch(setTranscription(''));
        } else {
          micInterimTranscription.current = '';
          setMicTranscription('');
        }
      }
      setIsProcessing(false);
    }
  };

  const formatAndDisplayResponse = useCallback((response) => {
    if (!response) return null;
    return (
      <ReactMarkdown
        components={{
          code({ node, inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            return !inline && match ? (
              <Box sx={{
                my: 1,
                position: 'relative',
                '& pre': {
                  borderRadius: '4px',
                  padding: '12px !important',
                  fontSize: '0.875rem',
                  overflowX: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }
              }}>
                <pre><code className={className} {...props} dangerouslySetInnerHTML={{ __html: hljs.highlight(String(children).replace(/\n$/, ''), { language: match[1], ignoreIllegals: true }).value }} /></pre>
              </Box>
            ) : (
              <code
                className={className}
                {...props}
                style={{
                  backgroundColor: 'rgba(0,0,0,0.05)',
                  padding: '2px 4px',
                  borderRadius: '4px',
                  fontFamily: 'monospace',
                  fontSize: '0.875rem',
                  wordBreak: 'break-all'
                }}
              >
                {children}
              </code>
            );
          },
          p: ({ node, ...props }) => <Typography paragraph {...props} sx={{ mb: 1, fontSize: '0.95rem', wordBreak: 'break-word' }} />,
          strong: ({ node, ...props }) => <Typography component="strong" fontWeight="bold" {...props} />,
          em: ({ node, ...props }) => <Typography component="em" fontStyle="italic" {...props} />,
          ul: ({ node, ...props }) => <Typography component="ul" sx={{ pl: 2.5, mb: 1, fontSize: '0.95rem', wordBreak: 'break-word' }} {...props} />,
          ol: ({ node, ...props }) => <Typography component="ol" sx={{ pl: 2.5, mb: 1, fontSize: '0.95rem', wordBreak: 'break-word' }} {...props} />,
          li: ({ node, ...props }) => <Typography component="li" sx={{ mb: 0.25, fontSize: '0.95rem', wordBreak: 'break-word' }} {...props} />,
        }}
      >
        {response}
      </ReactMarkdown>
    );
  }, []);

  const renderHistoryItem = (item, index) => {
    if (item.type !== 'response' && item.type !== 'current_streaming') return null;
    const Icon = SmartToyIcon;
    const title = 'AI Assistant';
    const avatarBgColor = theme.palette.secondary.light;

    return (
      <ListItem key={`response-${index}`} sx={{ alignItems: 'flex-start', px: 0, py: 1.5 }}>
        <Avatar sx={{ bgcolor: avatarBgColor, mr: 2, mt: 0.5 }}>
          <Icon sx={{ color: theme.palette.getContrastText(avatarBgColor) }} />
        </Avatar>
        <Paper variant="outlined" sx={{ p: 1.5, flexGrow: 1, bgcolor: theme.palette.background.default, borderColor: theme.palette.divider, overflowX: 'auto' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
            <Typography variant="subtitle2" fontWeight="bold">{title}</Typography>
            <Typography variant="caption" color="text.secondary">{item.timestamp}</Typography>
          </Box>
          {formatAndDisplayResponse(item.text)}
        </Paper>
      </ListItem>
    );
  };

  const renderQuestionHistoryItem = (item, index) => {
    const Icon = item.source === 'system' ? HearingIcon : PersonIcon;
    const title = item.source === 'system' ? 'Interviewer' : 'Candidate';
    const avatarBgColor = item.source === 'system' ? theme.palette.info.light : theme.palette.success.light;

    return (
      <ListItem
        key={`question-hist-${index}`}
        secondaryAction={
          <Checkbox
            edge="end"
            checked={selectedQuestions.includes(index)}
            onChange={() => {
              setSelectedQuestions(prev =>
                prev.includes(index) ? prev.filter(x => x !== index) : [...prev, index]
              );
            }}
            color="secondary"
            size="small"
          />
        }
        disablePadding
        sx={{ py: 0.5, display: 'flex', alignItems: 'center' }}
      >
        <Avatar sx={{ bgcolor: avatarBgColor, mr: 1.5, width: 32, height: 32, fontSize: '1rem' }}>
          <Icon fontSize="small" />
        </Avatar>
        <ListItemText
          primary={
            <Typography variant="body2" noWrap sx={{ fontWeight: selectedQuestions.includes(index) ? 'bold' : 'normal', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {item.text}
            </Typography>
          }
          secondary={`${title} - ${item.timestamp}`}
        />
      </ListItem>
    );
  };

  const handleSortOrderToggle = () => {
    setAiResponseSortOrder(prev => prev === 'newestAtBottom' ? 'newestAtTop' : 'newestAtBottom');
  };

  const getAiResponsesToDisplay = () => {
    let responses = history.filter(item => item.type === 'response').slice();
    const currentStreamingText = aiResponseFromStore;

    if (isProcessing && currentStreamingText && currentStreamingText.trim() !== '') {
      responses.push({ text: currentStreamingText, timestamp: 'Streaming...', type: 'current_streaming' });
    }

    if (aiResponseSortOrder === 'newestAtTop') {
      return responses.reverse();
    }
    return responses;
  };

  const togglePipWindow = async () => {
    if (isPipWindowActive) {
      if (documentPipWindowRef.current && typeof documentPipWindowRef.current.close === 'function') {
        try {
          await documentPipWindowRef.current.close();
        } catch (e) { console.error("Error closing document PiP window:", e); }
      } else if (pipWindowRef.current && !pipWindowRef.current.closed) {
        pipWindowRef.current.close();
      }
      return; // State update will be handled by pagehide/interval listeners
    }

    const addResizeListener = (pipWindow) => {
      const handlePipResize = debounce(() => {
        if (!pipWindow || (pipWindow.closed)) return;
        const target = documentPipIframeRef.current ? documentPipIframeRef.current.contentWindow : pipWindow;
        if (target) {
          target.postMessage({
            type: 'PIP_RESIZE',
            payload: {
              width: pipWindow.innerWidth,
              height: pipWindow.innerHeight
            }
          }, '*');
        }
      }, 50);

      pipWindow.addEventListener('resize', handlePipResize);
      return () => pipWindow.removeEventListener('resize', handlePipResize); // Return a cleanup function
    };

    if (window.documentPictureInPicture && typeof window.documentPictureInPicture.requestWindow === 'function') {
      try {
        const pipOptions = { width: 400, height: 300 };
        const requestedPipWindow = await window.documentPictureInPicture.requestWindow(pipOptions);
        documentPipWindowRef.current = requestedPipWindow;
        setIsPipWindowActive(true);

        const iframe = documentPipWindowRef.current.document.createElement('iframe');
        iframe.src = '/pip-log';
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.border = 'none';
        documentPipWindowRef.current.document.body.style.margin = '0';
        documentPipWindowRef.current.document.body.style.overflow = 'hidden';
        documentPipWindowRef.current.document.body.append(iframe);
        documentPipIframeRef.current = iframe;

        const removeResizeListener = addResizeListener(documentPipWindowRef.current);

        iframe.onload = () => {
          if (documentPipIframeRef.current && documentPipIframeRef.current.contentWindow) {
            documentPipIframeRef.current.contentWindow.postMessage({
              type: 'AI_LOG_DATA',
              payload: {
                historicalResponses: history.filter(item => item.type === 'response'),
                currentStreamingText: isProcessing ? aiResponseFromStore : '',
                isProcessing: isProcessing,
                sortOrder: aiResponseSortOrder
              }
            }, '*');
          }
        };

        documentPipWindowRef.current.addEventListener('pagehide', () => {
          removeResizeListener();
          setIsPipWindowActive(false);
          documentPipWindowRef.current = null;
          documentPipIframeRef.current = null;
        });

        showSnackbar('Native PiP window opened.', 'success');
        return;

      } catch (err) {
        console.error('Document Picture-in-Picture API error:', err);
        showSnackbar(`Native PiP not available or failed. Trying popup. (${err.message})`, 'warning');
      }
    }

    pipWindowRef.current = window.open('/pip-log', 'AIResponsePiP', 'width=400,height=550,resizable=yes,scrollbars=yes,status=no,toolbar=no,menubar=no,location=no,noopener,noreferrer,popup=yes');

    if (pipWindowRef.current) {
      setIsPipWindowActive(true);
      const removeResizeListener = addResizeListener(pipWindowRef.current);

      pipWindowRef.current.onload = () => {
        if (pipWindowRef.current && !pipWindowRef.current.closed) {
          pipWindowRef.current.postMessage({
            type: 'AI_LOG_DATA',
            payload: {
              historicalResponses: history.filter(item => item.type === 'response'),
              currentStreamingText: isProcessing ? aiResponseFromStore : '',
              isProcessing: isProcessing,
              sortOrder: aiResponseSortOrder
            }
          }, '*');
        }
      };
      const pipCheckInterval = setInterval(() => {
        if (pipWindowRef.current && pipWindowRef.current.closed) {
          clearInterval(pipCheckInterval);
          removeResizeListener();
          setIsPipWindowActive(false);
          pipWindowRef.current = null;
        }
      }, 500);
      if (pipWindowRef.current) pipWindowRef.current._pipIntervalId = pipCheckInterval;
    } else {
      showSnackbar('Failed to open PiP window. Please check popup blocker settings.', 'error');
      setIsPipWindowActive(false);
    }
  };

  useEffect(() => {
    return () => {
      if (pipWindowRef.current && pipWindowRef.current._pipIntervalId) {
        clearInterval(pipWindowRef.current._pipIntervalId);
      }
      if (documentPipWindowRef.current && typeof documentPipWindowRef.current.close === 'function') {
        try { documentPipWindowRef.current.close(); } catch (e) { /*ignore*/ }
      }
    };
  }, []);

  useEffect(() => {
    let targetWindowForMessage = null;

    if (documentPipWindowRef.current && documentPipIframeRef.current && documentPipIframeRef.current.contentWindow) {
      targetWindowForMessage = documentPipIframeRef.current.contentWindow;
    } else if (pipWindowRef.current && !pipWindowRef.current.closed) {
      targetWindowForMessage = pipWindowRef.current;
    }

    if (isPipWindowActive && targetWindowForMessage) {
      try {
        targetWindowForMessage.postMessage({
          type: 'AI_LOG_DATA',
          payload: {
            historicalResponses: history.filter(item => item.type === 'response'),
            currentStreamingText: isProcessing ? aiResponseFromStore : '',
            isProcessing: isProcessing,
            sortOrder: aiResponseSortOrder
          }
        }, '*');
      } catch (e) {
        console.warn("Could not post message to PiP window:", e);
      }
    }
  }, [history, aiResponseFromStore, isPipWindowActive, aiResponseSortOrder, isProcessing]);

  return (
    <>
      <Head>
        <title>Interview Copilot - Active Session</title>
      </Head>
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <AppBar position="static" color="default" elevation={1}>
          <Toolbar>
            <SmartToyIcon sx={{ mr: 2, color: 'primary.main' }} />
            <Typography variant="h6" component="div" sx={{ flexGrow: 1, color: 'text.primary' }}>
              Interview Copilot
            </Typography>
            <Tooltip title="Settings">
              <IconButton color="primary" onClick={() => setSettingsOpen(true)} aria-label="settings">
                <SettingsIcon />
              </IconButton>
            </Tooltip>
          </Toolbar>
        </AppBar>

        <Container maxWidth="xl" sx={{ flexGrow: 1, py: 2, display: 'flex', flexDirection: 'column' }}>
          <Grid container spacing={2} sx={{ flexGrow: 1 }}>
            {/* Left Panel */}
            <Grid item xs={12} md={3} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Card>
                <CardHeader title="System Audio (Interviewer)" avatar={<HearingIcon />} sx={{ pb: 1 }} />
                <CardContent>
                  <FormControlLabel
                    control={<Switch checked={systemAutoMode} onChange={e => setSystemAutoMode(e.target.checked)} color="primary" />}
                    label="Auto-Submit Question"
                    sx={{ mb: 1 }}
                  />
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    variant="outlined"
                    value={transcriptionFromStore}
                    onChange={(e) => handleManualInputChange(e.target.value, 'system')}
                    onKeyDown={(e) => handleKeyPress(e, 'system')}
                    placeholder="Interviewer's speech..."
                    sx={{ mb: 2 }}
                  />
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Button
                      onClick={startSystemAudioRecognition}
                      variant="contained"
                      color={isSystemAudioActive ? 'error' : 'primary'}
                      startIcon={isSystemAudioActive ? <StopScreenShareIcon /> : <ScreenShareIcon />}
                      sx={{ flexGrow: 1 }}
                    >
                      {isSystemAudioActive ? 'Stop System Audio' : 'Record System Audio'}
                    </Button>
                    <Typography variant="caption" sx={{ mt: 1, display: 'block', width: '100%' }}>
                      {isSystemAudioActive ? 'Recording system audio...' : 'Select "Chrome Tab" and check "Share audio" when prompted.'}
                    </Typography>
                    <Tooltip title="Clear System Transcription">
                      <IconButton onClick={handleClearSystemTranscription}><DeleteSweepIcon /></IconButton>
                    </Tooltip>
                    {!systemAutoMode && (
                      <Button
                        onClick={() => handleManualSubmit('system')}
                        variant="outlined"
                        color="primary"
                        startIcon={<SendIcon />}
                        disabled={isProcessing || !transcriptionFromStore.trim()}
                      >
                        Submit
                      </Button>
                    )}
                  </Box>
                </CardContent>
              </Card>
              <Card sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                <CardHeader
                  title="Question History"
                  avatar={<PlaylistAddCheckIcon />}
                  action={
                    <Button
                      variant="contained"
                      size="small"
                      onClick={handleCombineAndSubmit}
                      disabled={selectedQuestions.length === 0 || isProcessing}
                      startIcon={isProcessing ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
                    >
                      Ask Combined
                    </Button>
                  }
                  sx={{ pb: 1, borderBottom: `1px solid ${theme.palette.divider}` }}
                />
                <CardContent sx={{ flexGrow: 1, overflow: 'hidden', p: 0 }}>
                  <ScrollToBottom className="scroll-to-bottom" followButtonClassName="hidden-follow-button">
                    <List dense sx={{ pt: 0, px: 1 }}>
                      {history.filter(e => e.type === 'question').slice().reverse().map(renderQuestionHistoryItem)}
                    </List>
                  </ScrollToBottom>
                </CardContent>
              </Card>
            </Grid>

            {/* Center Panel */}
            <Grid item xs={12} md={6} sx={{ display: 'flex', flexDirection: 'column' }}>
              <Card sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                <CardHeader
                  title="AI Assistant Log"
                  avatar={<SmartToyIcon />}
                  action={
                    <>
                      <Tooltip title={isPipWindowActive ? "Close PiP Log" : "Open PiP Log"}>
                        <IconButton onClick={togglePipWindow} size="small" color={isPipWindowActive ? "secondary" : "default"}>
                          <PictureInPictureAltIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={aiResponseSortOrder === 'newestAtTop' ? "Sort: Newest at Bottom" : "Sort: Newest on Top"}>
                        <IconButton onClick={handleSortOrderToggle} size="small">
                          {aiResponseSortOrder === 'newestAtTop' ? <ArrowDownwardIcon /> : <ArrowUpwardIcon />}
                        </IconButton>
                      </Tooltip>
                      <Typography variant="caption" sx={{ mr: 1, fontStyle: 'italic' }}>
                        {aiResponseSortOrder === 'newestAtTop' ? "Newest First" : "Oldest First"}
                      </Typography>
                      <FormControlLabel
                        control={<Switch checked={autoScroll} onChange={(e) => setAutoScroll(e.target.checked)} color="primary" />}
                        label="Auto Scroll"
                        sx={{ ml: 1 }}
                      />
                    </>
                  }
                  sx={{ borderBottom: `1px solid ${theme.palette.divider}` }}
                />
                <CardContent sx={{ flexGrow: 1, overflow: 'hidden', p: 0 }}>
                  <ScrollToBottom
                    className="scroll-to-bottom"
                    mode={autoScroll ? (aiResponseSortOrder === 'newestAtTop' ? "top" : "bottom") : undefined}
                    followButtonClassName="hidden-follow-button"
                  >
                    <List sx={{ px: 2, py: 1 }}>
                      {getAiResponsesToDisplay().map(renderHistoryItem)}
                      {isProcessing && (
                        <ListItem sx={{ justifyContent: 'center', py: 2 }}>
                          <CircularProgress size={24} />
                          <Typography variant="caption" sx={{ ml: 1 }}>AI is thinking...</Typography>
                        </ListItem>
                      )}
                    </List>
                  </ScrollToBottom>
                </CardContent>
              </Card>
            </Grid>

            {/* Right Panel */}
            <Grid item xs={12} md={3} sx={{ display: 'flex', flexDirection: 'column' }}>
              <Card sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                <CardHeader title="Your Mic (Candidate)" avatar={<PersonIcon />} sx={{ pb: 1 }} />
                <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                  <FormControlLabel
                    control={<Switch checked={isManualMode} onChange={e => setIsManualMode(e.target.checked)} color="primary" />}
                    label="Manual Input Mode"
                    sx={{ mb: 1 }}
                  />
                  <TextField
                    fullWidth
                    multiline
                    rows={8}
                    variant="outlined"
                    value={micTranscription}
                    onChange={(e) => handleManualInputChange(e.target.value, 'microphone')}
                    onKeyDown={(e) => handleKeyPress(e, 'microphone')}
                    placeholder="Your speech or manual input..."
                    sx={{ mb: 2, flexGrow: 1 }}
                  />
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 'auto' }}>
                    <Button
                      onClick={startMicrophoneRecognition}
                      variant="contained"
                      color={isMicrophoneActive ? 'error' : 'primary'}
                      startIcon={isMicrophoneActive ? <MicOffIcon /> : <MicIcon />}
                      sx={{ flexGrow: 1 }}
                    >
                      {isMicrophoneActive ? 'Stop Mic' : 'Start Mic'}
                    </Button>
                    <Tooltip title="Clear Your Transcription">
                      <IconButton onClick={handleClearMicTranscription}><DeleteSweepIcon /></IconButton>
                    </Tooltip>
                    {isManualMode && (
                      <Button
                        onClick={() => handleManualSubmit('microphone')}
                        variant="outlined"
                        color="primary"
                        startIcon={<SendIcon />}
                        disabled={isProcessing || !micTranscription.trim()}
                      >
                        Submit
                      </Button>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
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