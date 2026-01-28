import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  ListSubheader,
  Typography,
  Box,
  Divider,
  IconButton,
  Tooltip,
  Chip,
  Grid,
  RadioGroup,
  FormControlLabel,
  Radio
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SaveIcon from '@mui/icons-material/Save';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import DeleteIcon from '@mui/icons-material/Delete';
import { getConfig, setConfig, builtInModelGroups } from '../utils/config'; // Import builtInModelGroups

export default function SettingsDialog({ open, onClose, onSave }) {
  const [settings, setSettings] = useState(getConfig());
  const [newModelName, setNewModelName] = useState('');
  const [newModelId, setNewModelId] = useState('');
  const [newModelType, setNewModelType] = useState('openai'); // 'openai' or 'gemini'

  useEffect(() => {
    if (open) {
      setSettings(getConfig());
      // Reset new model fields when dialog opens
      setNewModelName('');
      setNewModelId('');
      setNewModelType('openai');
    }
  }, [open]);

  const handleChange = (e) => {
    setSettings({ ...settings, [e.target.name]: e.target.value });
  };

  const handleAddNewModel = () => {
    if (!newModelName.trim() || !newModelId.trim()) {
      alert('Please provide both a display name and an ID for the new model.');
      return;
    }
    const newModel = { label: newModelName.trim(), value: newModelId.trim(), type: newModelType };
    const updatedCustomModels = [...(settings.customModels || []), newModel];
    setSettings({ ...settings, customModels: updatedCustomModels });
    setNewModelName('');
    setNewModelId('');
    // Keep newModelType for potentially adding another of the same type
  };

  const handleRemoveCustomModel = (indexToRemove) => {
    const updatedCustomModels = (settings.customModels || []).filter((_, index) => index !== indexToRemove);
    // If the currently selected model was the one removed, reset to a default
    let currentAiModel = settings.aiModel;
    if (settings.customModels[indexToRemove]?.value === currentAiModel) {
      currentAiModel = builtInModelGroups[0]?.models[0]?.value || 'gpt-3.5-turbo'; // Fallback
    }
    setSettings({ ...settings, customModels: updatedCustomModels, aiModel: currentAiModel });
  };


  const handleSave = () => {
    // Validate model-key pairing
    const selectedModelValue = settings.aiModel;
    let selectedModelIsGemini = selectedModelValue.startsWith('gemini');

    // Check if the selected model is a custom Gemini model
    const customGeminiModel = (settings.customModels || []).find(m => m.value === selectedModelValue && m.type === 'gemini');
    if (customGeminiModel) {
      selectedModelIsGemini = true;
    }
    // Check if the selected model is a custom OpenAI model
    const customOpenAIModel = (settings.customModels || []).find(m => m.value === selectedModelValue && m.type === 'openai');
    if (customOpenAIModel && !selectedModelIsGemini) { // if it's custom and not already flagged as gemini
      // it's an OpenAI type model
    }


    if (selectedModelIsGemini && !settings.geminiKey) {
      alert('Selected Gemini model requires a Gemini API key. Please enter a key or select a different model.');
      return;
    }
    if (!selectedModelIsGemini && !customOpenAIModel && !settings.openaiKey && !selectedModelValue.startsWith('gemini')) { // It's a built-in OpenAI or non-Gemini custom
      alert('Selected OpenAI model requires an OpenAI API key. Please enter a key or select a different model.');
      return;
    }
    if (customOpenAIModel && !settings.openaiKey) {
      alert('Selected custom OpenAI-type model requires an OpenAI API key.');
      return;
    }


    if (!settings.azureToken || !settings.azureRegion) {
      alert('Azure Speech Token and Region are required for voice transcription.');
    }

    setConfig(settings); // Uses the setConfig from utils/config.js
    if (onSave) onSave();
    onClose();
  };


  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid', borderColor: 'divider', pb: 1.5 }}>
        Application Settings
        <IconButton aria-label="close" onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ pt: 2.5 }}>
        <Typography variant="h6" gutterBottom>API Keys</Typography>
        <TextField
          fullWidth margin="dense" name="openaiKey" label="OpenAI API Key" type="password"
          value={settings.openaiKey || ''} onChange={handleChange} helperText="Required for OpenAI models."
        />
        <TextField
          fullWidth margin="dense" name="geminiKey" label="Gemini API Key" type="password"
          value={settings.geminiKey || ''} onChange={handleChange} helperText="Required for Gemini models." sx={{ mt: 2 }}
        />

        <Divider sx={{ my: 3 }} />
        <Typography variant="h6" gutterBottom>AI Configuration</Typography>
        <FormControl fullWidth margin="dense">
          <InputLabel id="ai-model-select-label">AI Model</InputLabel>
          <Select
            labelId="ai-model-select-label" name="aiModel" value={settings.aiModel}
            onChange={handleChange} label="AI Model"
          >
            {builtInModelGroups.map(group => ([
              <ListSubheader key={group.name} sx={{ fontWeight: 'bold', color: 'text.primary', bgcolor: 'transparent', lineHeight: '2.5em' }}>
                {group.name}
              </ListSubheader>,
              ...group.models.map(model => (
                <MenuItem key={model.value} value={model.value}>{model.label}</MenuItem>
              ))
            ]))}
            {(settings.customModels && settings.customModels.length > 0) && (
              <ListSubheader sx={{ fontWeight: 'bold', color: 'text.primary', bgcolor: 'transparent', lineHeight: '2.5em', mt: 1 }}>
                Custom Models
              </ListSubheader>
            )}
            {(settings.customModels || []).map((model, index) => (
              <MenuItem key={`custom-${model.value}-${index}`} value={model.value}>
                {model.label} ({model.type === 'gemini' ? 'Gemini' : 'OpenAI'})
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl fullWidth margin="dense" sx={{ mt: 2 }}>
          <InputLabel id="gemini-thinking-level-label">Gemini Thinking Level</InputLabel>
          <Select
            labelId="gemini-thinking-level-label" name="geminiThinkingLevel"
            value={settings.geminiThinkingLevel || 'auto'}
            onChange={handleChange} label="Gemini Thinking Level"
          >
            <MenuItem value="auto">Auto（動的・デフォルト）</MenuItem>
            <MenuItem value="off">Off（無効・2.5のみ）</MenuItem>
            <MenuItem value="minimal">Minimal（最小限）</MenuItem>
            <MenuItem value="low">Low（低）</MenuItem>
            <MenuItem value="medium">Medium（中）</MenuItem>
            <MenuItem value="high">High（高）</MenuItem>
          </Select>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
            Geminiモデルの推論レベルを設定します。Highは深い推論、Lowは高速レスポンス向けです。
          </Typography>
        </FormControl>

        <Divider sx={{ my: 3 }} />
        <Typography variant="h6" gutterBottom>面接先企業情報</Typography>
        <TextField
          fullWidth margin="dense" name="companyName" label="企業名"
          value={settings.companyName || ''} onChange={handleChange}
          helperText="面接を受ける企業名を入力してください。"
          placeholder="例: 株式会社〇〇"
        />
        <TextField
          fullWidth margin="dense" name="companyInfo" label="企業情報（業務内容・理念など）" multiline rows={4}
          value={settings.companyInfo || ''} onChange={handleChange}
          helperText="企業の業務内容、企業理念、求める人物像などを記入すると、その企業に合わせた回答を提案します。"
          sx={{ mt: 2 }}
          placeholder="【事業内容】&#10;〇〇事業を展開...&#10;&#10;【企業理念】&#10;「〇〇」を掲げ...&#10;&#10;【求める人物像】&#10;チャレンジ精神のある人..."
        />

        <Divider sx={{ my: 3 }} />
        <Typography variant="h6" gutterBottom>あなたの情報</Typography>
        <TextField
          fullWidth margin="dense" name="esContent" label="ES（エントリーシート）の内容" multiline rows={6}
          value={settings.esContent || ''} onChange={handleChange}
          helperText="自己PR、志望動機、ガクチカなどを記入すると、AIが回答時に参考にします。"
          sx={{ mt: 2 }}
          placeholder="【自己PR】&#10;私の強みは〇〇です...&#10;&#10;【志望動機】&#10;貴社を志望する理由は...&#10;&#10;【ガクチカ】&#10;学生時代に力を入れたことは..."
        />
        <TextField
          fullWidth margin="dense" name="gptSystemPrompt" label="AI System Prompt" multiline rows={3}
          value={settings.gptSystemPrompt} onChange={handleChange} helperText="AIへの指示を設定します。" sx={{ mt: 2 }}
        />
        <FormControl fullWidth margin="dense" sx={{ mt: 2 }}>
          <InputLabel id="response-length-label">AI Response Length</InputLabel>
          <Select
            labelId="response-length-label" name="responseLength" value={settings.responseLength}
            onChange={handleChange} label="AI Response Length"
          >
            <MenuItem value="concise">Concise (Brief & to the point)</MenuItem>
            <MenuItem value="medium">Medium (Balanced detail)</MenuItem>
            <MenuItem value="lengthy">Lengthy (Detailed explanations)</MenuItem>
          </Select>
        </FormControl>
        <TextField
          fullWidth margin="dense" name="conversationHistoryLimit" label="過去ログ件数"
          type="number" inputProps={{ step: 1, min: 0, max: 20 }}
          value={settings.conversationHistoryLimit ?? 6}
          onChange={handleChange}
          helperText="AIに送信する過去の会話履歴の件数（0〜20件）。多いほど文脈を理解しますがトークン数が増えます。"
          sx={{ mt: 2 }}
        />

        <Divider sx={{ my: 3 }} />
        <Typography variant="h6" gutterBottom>Manage Custom AI Models</Typography>
        <Box sx={{ p: 2, border: '1px dashed', borderColor: 'divider', borderRadius: 1, mb: 2 }}>
          <Typography variant="subtitle1" gutterBottom>Add New Model</Typography>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={4}>
              <TextField fullWidth margin="dense" label="Model Display Name" value={newModelName} onChange={(e) => setNewModelName(e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth margin="dense" label="Model ID / Path" value={newModelId} onChange={(e) => setNewModelId(e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={3}>
              <FormControl component="fieldset" margin="dense">
                <RadioGroup row name="newModelType" value={newModelType} onChange={(e) => setNewModelType(e.target.value)}>
                  <FormControlLabel value="openai" control={<Radio size="small" />} label="OpenAI" />
                  <FormControlLabel value="gemini" control={<Radio size="small" />} label="Gemini" />
                </RadioGroup>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={1}>
              <Tooltip title="Add Model">
                <IconButton color="primary" onClick={handleAddNewModel} disabled={!newModelName.trim() || !newModelId.trim()}>
                  <AddCircleOutlineIcon />
                </IconButton>
              </Tooltip>
            </Grid>
          </Grid>
        </Box>
        {(settings.customModels && settings.customModels.length > 0) && (
          <Box>
            <Typography variant="subtitle1" gutterBottom>Your Custom Models:</Typography>
            <List dense>
              {(settings.customModels || []).map((model, index) => (
                <ListItem
                  key={index}
                  secondaryAction={
                    <Tooltip title="Remove Model">
                      <IconButton edge="end" aria-label="delete" onClick={() => handleRemoveCustomModel(index)} size="small">
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  }
                  sx={{ mb: 0.5, bgcolor: 'action.hover', borderRadius: 1, p: 1 }}
                >
                  <ListItemText primary={model.label} secondary={`${model.value} (${model.type === 'gemini' ? 'Gemini' : 'OpenAI'})`} />
                </ListItem>
              ))}
            </List>
          </Box>
        )}


        <Divider sx={{ my: 3 }} />
        <Typography variant="h6" gutterBottom>Speech Configuration</Typography>
        <TextField
          fullWidth margin="dense" name="silenceTimerDuration" label="Silence Detection (seconds)"
          type="number" inputProps={{ step: 0.1, min: 0.5, max: 5 }} value={settings.silenceTimerDuration}
          onChange={handleChange} helperText="Auto-submit after this duration of silence (e.g., 1.2)."
        />
        <TextField
          fullWidth margin="dense" name="azureToken" label="Azure Speech API Key" type="password"
          value={settings.azureToken || ''} onChange={handleChange} helperText="Required for voice transcription." sx={{ mt: 2 }}
        />
        <TextField
          fullWidth margin="dense" name="azureRegion" label="Azure Region"
          value={settings.azureRegion || ''} onChange={handleChange} helperText="E.g., eastus, westus." sx={{ mt: 2 }}
        />
        <TextField
          fullWidth margin="dense" name="azureLanguage" label="Azure Recognition Language"
          value={settings.azureLanguage || ''} onChange={handleChange} helperText="E.g., en-US, es-ES." sx={{ mt: 2 }}
        />
      </DialogContent>
      <DialogActions sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
        <Button onClick={onClose} color="inherit">Cancel</Button>
        <Button onClick={handleSave} color="primary" variant="contained" startIcon={<SaveIcon />}>
          Save Settings
        </Button>
      </DialogActions>
    </Dialog>
  );
}

SettingsDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func
};
