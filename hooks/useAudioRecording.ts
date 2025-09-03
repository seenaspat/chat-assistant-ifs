import { useState, useRef } from 'react';
import { Platform } from 'react-native';
import { Audio } from 'expo-av';

export function useAudioRecording() {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startRecording = async () => {
    try {
      if (Platform.OS === 'web') {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        
        const chunks: BlobPart[] = [];
        mediaRecorder.ondataavailable = (event) => {
          chunks.push(event.data);
        };
        
        mediaRecorder.start();
        setIsRecording(true);
      } else {
        await Audio.requestPermissionsAsync();
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });

        const recording = new Audio.Recording();
        await recording.prepareToRecordAsync({
          android: {
            extension: '.m4a',
            outputFormat: Audio.AndroidOutputFormat.MPEG_4,
            audioEncoder: Audio.AndroidAudioEncoder.AAC,
          },
          ios: {
            extension: '.wav',
            outputFormat: Audio.IOSOutputFormat.LINEARPCM,
            audioQuality: Audio.IOSAudioQuality.HIGH,
            sampleRate: 44100,
            numberOfChannels: 2,
            bitRate: 128000,
          },
          web: {
            mimeType: 'audio/webm',
            bitsPerSecond: 128000,
          },
        });

        await recording.startAsync();
        recordingRef.current = recording;
        setIsRecording(true);
      }
    } catch (error) {
      console.error('Failed to start recording:', error);
      throw error;
    }
  };

  const stopRecording = async (): Promise<string | null> => {
    if (!isRecording) {
      console.log('Recording is not active, skipping stop');
      return null;
    }

    setIsProcessing(true);
    
    try {
      if (Platform.OS === 'web') {
        return new Promise((resolve) => {
          const mediaRecorder = mediaRecorderRef.current;
          if (!mediaRecorder || mediaRecorder.state === 'inactive') {
            setIsRecording(false);
            setIsProcessing(false);
            resolve(null);
            return;
          }

          const chunks: BlobPart[] = [];
          mediaRecorder.ondataavailable = (event) => {
            chunks.push(event.data);
          };

          mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(chunks, { type: 'audio/wav' });
            const transcript = await transcribeAudio(audioBlob);
            
            if (streamRef.current) {
              streamRef.current.getTracks().forEach(track => track.stop());
              streamRef.current = null;
            }
            
            mediaRecorderRef.current = null;
            setIsRecording(false);
            setIsProcessing(false);
            resolve(transcript);
          };

          mediaRecorder.stop();
        });
      } else {
        const recording = recordingRef.current;
        if (!recording) {
          setIsRecording(false);
          setIsProcessing(false);
          return null;
        }

        // Check if recording is still active before stopping
        const status = await recording.getStatusAsync();
        if (!status.isRecording) {
          console.log('Recording is not active, cleaning up');
          recordingRef.current = null;
          setIsRecording(false);
          setIsProcessing(false);
          return null;
        }

        await recording.stopAndUnloadAsync();
        recordingRef.current = null;
        
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

        const uri = recording.getURI();
        if (!uri) {
          setIsRecording(false);
          setIsProcessing(false);
          return null;
        }

        const transcript = await transcribeAudioFromUri(uri);
        
        setIsRecording(false);
        setIsProcessing(false);
        return transcript;
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
      
      // Clean up references on error
      if (Platform.OS === 'web') {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
        mediaRecorderRef.current = null;
      } else {
        recordingRef.current = null;
        try {
          await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
        } catch (audioError) {
          console.error('Failed to reset audio mode:', audioError);
        }
      }
      
      setIsRecording(false);
      setIsProcessing(false);
      return null;
    }
  };

  const transcribeAudio = async (audioBlob: Blob): Promise<string | null> => {
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.wav');

      const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || '';
      const response = await fetch(`${baseUrl}/api/stt`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Transcription failed');
      }

      const data = await response.json();
      return data.text || null;
    } catch (error) {
      console.error('Transcription error:', error);
      return null;
    }
  };

  const transcribeAudioFromUri = async (uri: string): Promise<string | null> => {
    try {
      const uriParts = uri.split('.');
      const fileType = uriParts[uriParts.length - 1];

      const audioFile = {
        uri,
        name: `recording.${fileType}`,
        type: `audio/${fileType}`,
      };

      const formData = new FormData();
      formData.append('audio', audioFile as any);

      const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || '';
      const response = await fetch(`${baseUrl}/api/stt`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Transcription failed');
      }

      const data = await response.json();
      return data.text || null;
    } catch (error) {
      console.error('Transcription error:', error);
      return null;
    }
  };

  return {
    isRecording,
    isProcessing,
    startRecording,
    stopRecording,
  };
}