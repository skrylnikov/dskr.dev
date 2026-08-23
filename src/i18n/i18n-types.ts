/* eslint-disable */
import type { BaseTranslation as BaseTranslationType, LocalizedString } from 'typesafe-i18n';

export type BaseTranslation = BaseTranslationType;
export type BaseLocale = 'ru';
export type Locales = 'en' | 'ru';

export type Translation = RootTranslation;
export type Translations = RootTranslation;

type RootTranslation = {
	home: {
		userName: string;
		role: string;
		eyebrow: string;
		title: string;
		intro: string;
		viewAbout: string;
		viewProjects: string;
		latest: string;
		projects: string;
	};
	nav: {
		label: string;
		blog: string;
		projects: string;
		about: string;
	};
	preview: { readMore: string };
	post: { edit: string };
	changeLang: string;
	common: {
		skipToContent: string;
		openProject: string;
		source: string;
		tryIt: string;
	};
	theme: {
		label: string;
		light: string;
		system: string;
		dark: string;
	};
	projects: { title: string; intro: string; stack: string };
	about: {
		title: string;
		lead: string;
		workTitle: string;
		work: string;
		outsideTitle: string;
		outside: string;
		projectsTitle: string;
		projects: string;
		contactTitle: string;
		contact: string;
	};
};

export type TranslationFunctions = {
	home: { [K in keyof RootTranslation['home']]: () => LocalizedString };
	nav: { [K in keyof RootTranslation['nav']]: () => LocalizedString };
	preview: { readMore: () => LocalizedString };
	post: { edit: () => LocalizedString };
	changeLang: () => LocalizedString;
	common: { [K in keyof RootTranslation['common']]: () => LocalizedString };
	theme: { [K in keyof RootTranslation['theme']]: () => LocalizedString };
	projects: { [K in keyof RootTranslation['projects']]: () => LocalizedString };
	about: { [K in keyof RootTranslation['about']]: () => LocalizedString };
};

export type Formatters = {};
