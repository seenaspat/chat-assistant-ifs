import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface VoiceOrbProps {
  isActive: boolean;
  isRecording: boolean;
  isSpeaking: boolean;
}

export function VoiceOrb({ isActive, isRecording, isSpeaking }: VoiceOrbProps) {

  const rotateAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isActive) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();

      if (isSpeaking) {
        const rotate = Animated.loop(
          Animated.timing(rotateAnim, {
            toValue: 1,
            duration: 3000,
            useNativeDriver: true,
          })
        );
        rotate.start();
      }

      return () => {
        pulse.stop();
        if (isSpeaking) {
          rotateAnim.setValue(0);
        }
      };
    } else {
      pulseAnim.setValue(1);
      rotateAnim.setValue(0);
    }
  }, [isActive, isSpeaking, pulseAnim, rotateAnim]);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const getGradientColors = (): [string, string, string] => {
    if (isRecording) {
      return ['#ff6b6b', '#ff8e8e', '#ffb3b3'];
    }
    if (isSpeaking) {
      return ['#4ecdc4', '#44a08d', '#096a5d'];
    }
    return ['#4a9eff', '#6bb6ff', '#8cc8ff'];
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [
            { scale: pulseAnim },
            { rotate: spin },
          ],
        },
      ]}
    >
      <LinearGradient
        colors={getGradientColors()}
        style={styles.orb}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.innerOrb}>
          <LinearGradient
            colors={['rgba(255,255,255,0.3)', 'rgba(255,255,255,0.1)']}
            style={styles.highlight}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
        </View>
      </LinearGradient>
      
      {isActive && (
        <View style={styles.outerRing}>
          <LinearGradient
            colors={getGradientColors().map(color => color + '40') as [string, string, string]}
            style={styles.ring}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orb: {
    width: 160,
    height: 160,
    borderRadius: 80,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4a9eff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  innerOrb: {
    width: 140,
    height: 140,
    borderRadius: 70,
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    overflow: 'hidden',
  },
  highlight: {
    width: 60,
    height: 60,
    borderRadius: 30,
    margin: 20,
  },
  outerRing: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ring: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 2,
    borderColor: 'transparent',
  },
});