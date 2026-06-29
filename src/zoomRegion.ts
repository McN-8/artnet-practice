export class ZoomRegion {

  id: string;

  x: number;

  y: number;

  width: number;

  height: number;

  description: string;

  constructor(

    id: string,

    x: number,

    y: number,

    width: number,

    height: number,

    description: string

  ) {

    this.id = id;

    this.x = x;

    this.y = y;

    this.width = width;

    this.height = height;

    this.description = description;

  }

}