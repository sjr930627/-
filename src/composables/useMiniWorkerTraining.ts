import { computed } from 'vue'
import { useAppStore } from '@/stores/app'
import { useMiniAppWorker } from '@/composables/useMiniAppWorker'
import { getLearningProgress, resolveCourseAssignees, canAccessMaterial } from '@/services/training'
import { learningStatusMap } from '@/constants/training'
import type { TrainingMaterial } from '@/types'

export function useMiniWorkerTraining() {
  const store = useAppStore()
  const { employeeId } = useMiniAppWorker()

  const myCourses = computed(() => {
    const courses = store.trainingCourses.filter((c) => c.status === 'published')
    return courses
      .filter((c) =>
        resolveCourseAssignees(c, store.employees, store.departments).some(
          (e) => e.id === employeeId.value,
        ),
      )
      .map((c) => {
        let rec = store.courseLearningRecords.find(
          (r) => r.courseId === c.id && r.employeeId === employeeId.value,
        )
        if (!rec) {
          rec = {
            id: '',
            courseId: c.id,
            employeeId: employeeId.value,
            status: 'not_started',
            completedMaterialIds: [],
            studyMinutes: 0,
            updatedAt: '',
          }
        }
        const exam = c.examId ? store.trainingExams.find((e) => e.id === c.examId) : null
        const materials = c.materialIds
          .map((id) => store.trainingMaterials.find((m) => m.id === id))
          .filter((m): m is TrainingMaterial => !!m && m.status === 'approved')
          .map((m) => ({
            material: m,
            learned: rec.completedMaterialIds.includes(m.id),
            accessible: canAccessMaterial(c, m.id, rec.completedMaterialIds),
          }))
        return {
          course: c,
          record: rec,
          progress: getLearningProgress(rec, c),
          statusLabel: learningStatusMap[rec.status],
          exam,
          materialCount: c.materialIds.length,
          materials,
        }
      })
  })

  const completedMaterialIds = computed(() => {
    const ids = new Set<string>()
    for (const item of myCourses.value) {
      item.record.completedMaterialIds.forEach((id) => ids.add(id))
    }
    return ids
  })

  const myMaterials = computed(() => {
    const ids = new Set<string>()
    myCourses.value.forEach((item) => item.course.materialIds.forEach((id) => ids.add(id)))
    return store.trainingMaterials
      .filter((m) => ids.has(m.id) && m.status === 'approved')
      .map((m) => ({
        material: m,
        learned: completedMaterialIds.value.has(m.id),
      }))
  })

  const myExamAttempts = computed(() =>
    store.examAttempts
      .filter((a) => a.employeeId === employeeId.value)
      .map((a) => {
        const exam = store.trainingExams.find((e) => e.id === a.examId)
        const course = a.courseId ? store.trainingCourses.find((c) => c.id === a.courseId) : null
        return { attempt: a, exam, course }
      })
      .sort((a, b) => b.attempt.submittedAt.localeCompare(a.attempt.submittedAt)),
  )

  const examTasks = computed(() =>
    myCourses.value
      .filter((item) => item.exam && item.exam.status === 'published')
      .map((item) => {
        const attempts = store.examAttempts
          .filter((a) => a.employeeId === employeeId.value && a.examId === item.exam!.id)
          .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
        const lastAttempt = attempts[0]
        const withinRetakes =
          item.exam!.maxRetakes < 0 || attempts.length < item.exam!.maxRetakes
        const canTake =
          item.progress >= 100 &&
          (!lastAttempt || (!lastAttempt.passed && withinRetakes))
        let status: 'locked' | 'ready' | 'passed' | 'failed' = 'locked'
        if (item.progress < 100) status = 'locked'
        else if (lastAttempt?.passed) status = 'passed'
        else if (lastAttempt && !lastAttempt.passed) status = 'failed'
        else status = 'ready'
        return {
          courseId: item.course.id,
          courseName: item.course.name,
          exam: item.exam!,
          progress: item.progress,
          lastAttempt,
          attempts,
          attemptCount: attempts.length,
          canTake,
          status,
        }
      }),
  )

  const materialTypeIcon = (m: TrainingMaterial) => {
    if (m.type === 'video') return '🎬'
    if (m.type === 'pdf') return '📄'
    return '📰'
  }

  return {
    myCourses,
    myMaterials,
    myExamAttempts,
    examTasks,
    materialTypeIcon,
    canAccessMaterial,
  }
}
