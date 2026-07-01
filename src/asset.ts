export class Asset {
  file: string;
  type: string;

  constructor(file: string, type: string) {
    this.file = file;
    this.type = type;
  }
}