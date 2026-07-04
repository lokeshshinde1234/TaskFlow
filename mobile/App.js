import React, { useEffect, useState } from 'react';
import { Linking, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:8000/api';
const PWA_URL = process.env.EXPO_PUBLIC_PWA_URL || 'http://localhost:3000';

export default function App() {
  const [config, setConfig] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE_URL}/enterprise/mobile/config`)
      .then((response) => (response.ok ? response.json() : null))
      .then(setConfig)
      .catch(() => setConfig(null));
  }, []);

  const openPwa = (path) => {
    Linking.openURL(`${PWA_URL}${path}`).catch(() => null);
  };

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>TaskFlow Mobile</Text>
        <Text style={styles.title}>Workforce tools on the move</Text>
        <Text style={styles.copy}>
          Native shell for attendance, tasks, leave, and payslips. Modules deep-link into the PWA until a native screen is required.
        </Text>
      </View>
      <View style={styles.grid}>
        <TouchableOpacity style={styles.button} onPress={() => openPwa('/employee-dashboard')}>
          <Text style={styles.buttonText}>Attendance</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={() => openPwa('/admin-dashboard/enterprise')}>
          <Text style={styles.buttonText}>Admin Console</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.meta}>API: {config?.api_base_url || API_BASE_URL}</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f172a', padding: 24, justifyContent: 'center' },
  header: { gap: 10 },
  eyebrow: { color: '#67e8f9', fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  title: { color: '#ffffff', fontSize: 32, fontWeight: '900' },
  copy: { color: '#cbd5e1', fontSize: 16, lineHeight: 24 },
  grid: { gap: 12, marginTop: 28 },
  button: { backgroundColor: '#06b6d4', borderRadius: 8, padding: 16 },
  buttonText: { color: '#082f49', fontWeight: '900', textAlign: 'center' },
  meta: { color: '#94a3b8', marginTop: 24 },
});
