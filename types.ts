export interface RadioMessage {
  id: string;
  sender: string;
  text: string;
  timestamp: string;
}

export interface PlayerState {
  speed: number;
  altitude: number;
  position: [number, number, number]; // x, y, z
  rotation: number; // y rotation in radians
}

export interface CarControls {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  boost: boolean;
}

export interface BuildingData {
  x: number;
  z: number;
  width: number;
  height: number;
  depth: number;
  color: string;
}