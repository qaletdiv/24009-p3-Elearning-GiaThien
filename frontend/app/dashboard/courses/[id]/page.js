'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import CourseManageForm from '../../../../components/CourseManageForm'
import { getStoredUser, apiRequest } from '../../../../lib/api'

export default function UpdateCoursePage() {
  const params = useParams()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)

  useEffect(() => {
    const checkPermission = async () => {
      const user = getStoredUser()
      if (!user) {
        router.replace(`/auth?redirect=/dashboard/courses/${params.id}`)
        return
      }

      try {
        
        const res = await apiRequest(`/courses/${params.id}`)
        const course = res.data

        const isAdmin = user.role === 'admin'
        const isOwner = course.instructorId === user.id

        
        if (!isAdmin && !isOwner) {
          router.replace('/')
          return
        }

        setAuthorized(true)
      } catch (err) {
        console.error(err)
        router.replace('/')
      } finally {
        setLoading(false)
      }
    }

    checkPermission()
  }, [params.id, router])

  
  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <p className="text-slate-500">Đang kiểm tra quyền truy cập...</p>
      </div>
    )
  }

  if (!authorized) return null

  return (
    <section className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">
          Cập nhật khóa học
        </h1>
      </div>

     
      <CourseManageForm courseId={params.id} />
    </section>
  )
}