import { Response } from 'express'

interface CompatResponseOptions {
  route: string
  operation: string
  guidance: string
  removalTarget: string
}

export function respondCompatNotImplemented(
  res: Response,
  options: CompatResponseOptions,
): void {
  res.set({
    'Cache-Control': 'no-store',
    Deprecation: 'true',
    'X-VoxFlame-Route-Class': 'compat',
    'X-VoxFlame-Removal-Target': options.removalTarget,
  })

  res.status(501).json({
    error: 'Deprecated compatibility endpoint in single-agent architecture',
    classification: 'compat',
    route: options.route,
    operation: options.operation,
    guidance: options.guidance,
    removalTarget: options.removalTarget,
  })
}
