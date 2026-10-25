import { createRoot } from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';
import '@mantine/tiptap/styles.css';
import './style.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
	<MantineProvider defaultColorScheme="auto">
		<App />
	</MantineProvider>,
);
