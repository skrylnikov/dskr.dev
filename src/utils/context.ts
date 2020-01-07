import { ContinuationLocalStorage } from 'asyncctx';

interface LocalContext {
  data: any;
}

export const Context = new ContinuationLocalStorage<LocalContext>();
