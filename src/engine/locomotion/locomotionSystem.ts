import { RoomManifest } from '../../types/artmaze';
import { InputState } from '../input/inputController';

export interface CameraPose {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
}

export class LocomotionSystem {
  private pose: CameraPose = {
    x: 0,
    y: 1.7,
    z: 6.5,
    yaw: 0,
    pitch: 0,
  };

  public resetToRoomSpawn(manifest: RoomManifest): void {
    const spawnPos = manifest.environment.spawn?.position ?? [0, 1.7, 5.5];
    const spawnRot = manifest.environment.spawn?.rotation ?? [0, 0, 0];
    this.pose = {
      x: spawnPos[0],
      y: spawnPos[1] || 1.7,
      z: spawnPos[2],
      yaw: spawnRot[1] || 0,
      pitch: 0,
    };
  }

  public getPose(): CameraPose {
    return { ...this.pose };
  }

  public setPose(partial: Partial<CameraPose>): void {
    this.pose = { ...this.pose, ...partial };
  }

  public step(input: InputState, dt: number, manifest: RoomManifest, inVoid: boolean): CameraPose {
    const turnSpeed = 1.85;
    if (input.turnLeft) this.pose.yaw += turnSpeed * dt;
    if (input.turnRight) this.pose.yaw -= turnSpeed * dt;
    this.pose.yaw += input.yawDelta;
    this.pose.pitch = input.pitchDelta;

    const moveSpeed = manifest.rules?.locomotion === 'slow' ? 2.4 : 4.2;
    let forwardInput = 0;
    let strafeInput = 0;
    if (input.forward) forwardInput += 1;
    if (input.backward) forwardInput -= 1;
    if (input.right) strafeInput += 1;
    if (input.left) strafeInput -= 1;

    if (forwardInput !== 0 || strafeInput !== 0) {
      const len = Math.hypot(forwardInput, strafeInput);
      forwardInput /= len;
      strafeInput /= len;

      // Forward in our camera space (-Z when yaw = 0)
      const forwardX = -Math.sin(this.pose.yaw);
      const forwardZ = -Math.cos(this.pose.yaw);
      const rightX = Math.cos(this.pose.yaw);
      const rightZ = -Math.sin(this.pose.yaw);

      const nextX =
        this.pose.x + (forwardX * forwardInput + rightX * strafeInput) * moveSpeed * dt;
      const nextZ =
        this.pose.z + (forwardZ * forwardInput + rightZ * strafeInput) * moveSpeed * dt;

      if (inVoid) {
        this.pose.x = nextX;
        this.pose.z = nextZ;
      } else {
        const dims = manifest.environment.dimensions ?? [14, 5, 14];
        const halfW = dims[0] * 0.5 - 1.1;
        const halfD = dims[2] * 0.5 - 1.1;
        this.pose.x = Math.max(-halfW, Math.min(halfW, nextX));
        this.pose.z = Math.max(-halfD, Math.min(halfD, nextZ));
      }
    }

    return { ...this.pose };
  }
}
