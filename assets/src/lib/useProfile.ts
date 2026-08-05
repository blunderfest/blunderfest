import { useEffect, useState } from 'react'
import { ApiError, createProfile, fetchProfile, type Profile } from '@/lib/api'
import { clearDevice, loadDevice, saveDevice } from '@/lib/device'

type ProfileState =
  | { status: 'loading'; profile: null; error: null }
  | { status: 'ready'; profile: Profile; error: null }
  | { status: 'error'; profile: null; error: string }

export function useProfile(): ProfileState {
  const [state, setState] = useState<ProfileState>({
    status: 'loading',
    profile: null,
    error: null,
  })

  useEffect(() => {
    const controller = new AbortController()
    const signal = controller.signal

    async function bootstrap() {
      const device = loadDevice()

      if (device) {
        try {
          const profile = await fetchProfile(device)
          if (!signal.aborted) setState({ status: 'ready', profile, error: null })
          return
        } catch (error) {
          if (error instanceof ApiError && error.code === 'unauthorized') {
            clearDevice()
          } else {
            if (!signal.aborted) {
              setState({
                status: 'error',
                profile: null,
                error: error instanceof ApiError ? error.code : 'network',
              })
            }
            return
          }
        }
      }

      try {
        const { profile, secret } = await createProfile()
        saveDevice({ id: profile.id, secret })
        if (!signal.aborted) setState({ status: 'ready', profile, error: null })
      } catch (error) {
        if (!signal.aborted) {
          setState({
            status: 'error',
            profile: null,
            error: error instanceof ApiError ? error.code : 'network',
          })
        }
      }
    }

    void bootstrap()

    return () => controller.abort()
  }, [])

  return state
}
