export interface IPost {
  title: string;
  url: string;
  time: string;
  timeFormated: string;
  content: string;
}

export type IGetPostList = () => IPost[];