export class Panel {
  id: string;
  asset: string | undefined;
  accessibleDescription: string | undefined;

  constructor(
    id: string,
    asset?: string,
    accessibleDescription?: string
  ) {
    this.id = id;
    this.asset = asset;
    this.accessibleDescription = accessibleDescription;
  }
}
