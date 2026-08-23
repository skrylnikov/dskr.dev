export interface Project {
	slug: string;
	github: string;
	live?: string;
	image?: string;
	stack: string[];
	ru: { title: string; description: string };
	en: { title: string; description: string };
}

export const projects: Project[] = [
	{
		slug: 'dskr-dev',
		github: 'https://github.com/skrylnikov/dskr.dev',
		live: 'https://dskr.dev',
		stack: ['Astro', 'MDX', 'TypeScript', 'CSS'],
		ru: {
			title: 'dskr.dev',
			description: 'Личный блог о разработке, собственных проектах и вещах, которые интересно разбирать на практике.',
		},
		en: {
			title: 'dskr.dev',
			description: 'A personal blog about software development, side projects, and things worth understanding by building.',
		},
	},
	{
		slug: 'phoronis',
		github: 'https://github.com/skrylnikov/Phoronis-tg-bot',
		live: 'https://t.me/PhoronisBot',
		image: '/assets/telegram-bot-six-years/hero.png',
		stack: ['TypeScript', 'grammY', 'PostgreSQL', 'Prisma', 'OpenRouter', 'pgvector'],
		ru: {
			title: 'Phoronis / Ио',
			description: 'Telegram-бот с AI-возможностями, памятью, контекстом чата, обработкой изображений и голосовых сообщений.',
		},
		en: {
			title: 'Phoronis / Io',
			description: 'An AI-powered Telegram bot with chat context, memory, image and voice processing, and vector search.',
		},
	},
];
