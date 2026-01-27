import React from 'react';
import Head from 'next/head';
import { Box, Button, Container, Grid, Paper, Typography, Avatar } from '@mui/material';
import { styled } from '@mui/material/styles';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import MicIcon from '@mui/icons-material/Mic';
import RecordVoiceOverIcon from '@mui/icons-material/RecordVoiceOver';
import CodeIcon from '@mui/icons-material/Code';
import QuestionAnswerIcon from '@mui/icons-material/QuestionAnswer';
import SettingsIcon from '@mui/icons-material/Settings';
import SpeedIcon from '@mui/icons-material/Speed';
import Link from 'next/link'; // Import Next.js Link

const HeroSection = styled(Box)(({ theme }) => ({
  backgroundColor: theme.palette.primary.main, // Use primary color from theme
  color: theme.palette.primary.contrastText,
  padding: theme.spacing(12, 2),
  textAlign: 'center',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '70vh', // Make hero section taller
  clipPath: 'ellipse(150% 100% at 50% 0%)', // Soft curve at the bottom
}));

const FeaturePaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  textAlign: 'center',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'flex-start', // Align items to the top
  boxShadow: theme.shadows[3], // Use a subtle shadow from theme
  transition: 'transform 0.3s ease-in-out, box-shadow 0.3s ease-in-out',
  '&:hover': {
    transform: 'translateY(-5px)',
    boxShadow: theme.shadows[6],
  }
}));

const FeatureIcon = styled(Avatar)(({ theme }) => ({
  backgroundColor: theme.palette.secondary.main,
  color: theme.palette.secondary.contrastText,
  width: theme.spacing(7),
  height: theme.spacing(7),
  marginBottom: theme.spacing(2),
}));

const Section = styled(Box)(({ theme }) => ({
  padding: theme.spacing(8, 2),
}));

const Footer = styled(Box)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  color: theme.palette.text.secondary,
  padding: theme.spacing(4, 2),
  textAlign: 'center',
  borderTop: `1px solid ${theme.palette.divider}`,
}));

const features = [
  {
    icon: <RecordVoiceOverIcon fontSize="large" />,
    title: 'Real-time Transcription',
    description: 'Accurate voice-to-text for both interviewer and candidate, powered by Azure Cognitive Services.',
  },
  {
    icon: <QuestionAnswerIcon fontSize="large" />,
    title: 'AI-Powered Insights',
    description: 'Intelligent responses and suggestions with conversational context awareness using OpenAI/Gemini models.',
  },
  {
    icon: <CodeIcon fontSize="large" />,
    title: 'Code Formatting',
    description: 'Clear syntax highlighting for technical discussions, making code easy to read and understand.',
  },
  {
    icon: <SpeedIcon fontSize="large" />,
    title: 'Silence Detection',
    description: 'Automatically submit questions or responses after a configurable period of silence for a smoother flow.',
  },
  {
    icon: <SettingsIcon fontSize="large" />,
    title: 'Customizable Settings',
    description: 'Tailor AI models, API keys, and behavior to your specific needs and preferences.',
  },
];

export default function LandingPage() {
  return (
    <>
      <Head>
        <title>Interview Copilot - Your AI-Powered Interview Assistant</title>
        <meta name="description" content="Elevate your technical interviews with real-time transcription, AI insights, and seamless assistance. Perfect for interviewers and candidates." />
        <link rel="icon" href="/favicon.ico" /> {/* Remember to add a favicon */}
      </Head>

      <HeroSection>
        <Container maxWidth="md">
          <Typography variant="h2" component="h1" gutterBottom sx={{ fontWeight: 700, letterSpacing: '-1px' }}>
            Interview Copilot
          </Typography>
          <Typography variant="h5" component="p" paragraph sx={{ mb: 4, opacity: 0.9 }}>
            Elevate your technical interviews with AI-powered real-time transcription, intelligent suggestions, and seamless assistance. Focus on the conversation, let us handle the notes.
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/interview" passHref>
              <Button
                variant="contained"
                color="secondary"
                size="large"
                endIcon={<ArrowForwardIcon />}
                sx={{
                  padding: '12px 30px',
                  fontSize: '1.1rem',
                  boxShadow: '0px 4px 15px rgba(0,0,0,0.2)',
                  '&:hover': {
                    boxShadow: '0px 6px 20px rgba(0,0,0,0.25)',
                    transform: 'translateY(-2px)'
                  }
                }}
              >
                面接アシスト開始
              </Button>
            </Link>
            <Link href="/practice" passHref>
              <Button
                variant="outlined"
                size="large"
                endIcon={<MicIcon />}
                sx={{
                  padding: '12px 30px',
                  fontSize: '1.1rem',
                  borderColor: 'rgba(255,255,255,0.7)',
                  color: 'white',
                  '&:hover': {
                    borderColor: 'white',
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    transform: 'translateY(-2px)'
                  }
                }}
              >
                面接練習を始める
              </Button>
            </Link>
          </Box>
        </Container>
      </HeroSection>

      <Section id="features">
        <Container maxWidth="lg">
          <Typography variant="h4" component="h2" align="center" gutterBottom sx={{ mb: 6 }}>
            Why Choose Interview Copilot?
          </Typography>
          <Grid container spacing={4}>
            {features.map((feature) => (
              <Grid item xs={12} sm={6} md={4} key={feature.title}>
                <FeaturePaper elevation={3}> {/* Use elevation for subtle shadow */}
                  <FeatureIcon>{feature.icon}</FeatureIcon>
                  <Typography variant="h6" component="h3" gutterBottom>
                    {feature.title}
                  </Typography>
                  <Typography variant="body1" color="textSecondary">
                    {feature.description}
                  </Typography>
                </FeaturePaper>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Section>

      <Section id="about" sx={{ backgroundColor: 'rgba(0,0,0,0.02)' }}>
        <Container maxWidth="md">
          <Typography variant="h4" component="h2" align="center" gutterBottom sx={{ mb: 4 }}>
            About the Tool
          </Typography>
          <Typography variant="h6" component="p" align="center" color="textSecondary" paragraph>
            Interview Copilot is designed to be an indispensable assistant for technical interviews. Whether you're conducting interviews and need to capture key details, or you're a candidate wanting to review your performance, our tool provides the support you need.
          </Typography>
          <Typography variant="h6" component="p" align="center" color="textSecondary" paragraph>
            Our mission is to make interviews more productive and insightful by leveraging the power of AI, allowing participants to focus on what truly matters: the skills, experience, and potential being discussed.
          </Typography>
        </Container>
      </Section>

      <Footer>
        <Typography variant="body2">
          &copy; {new Date().getFullYear()} Interview Copilot. All rights reserved.
        </Typography>
        <Typography variant="caption" display="block" sx={{ mt: 1 }}>
          Powered by AI for smarter interviews.
        </Typography>
      </Footer>
    </>
  );
}
