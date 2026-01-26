import { useState, useEffect } from 'react';
import { Clock, DollarSign, CheckCircle } from 'lucide-react';

interface JobInteractionProps {
  jobId: string;
  jobName: string;
  payPerTask: number;
  taskDuration: number;
  onComplete: (jobId: string, reward: number) => void;
  onCancel: () => void;
}

export default function JobInteraction({
  jobId,
  jobName,
  payPerTask,
  taskDuration,
  onComplete,
  onCancel,
}: JobInteractionProps) {
  const [timeRemaining, setTimeRemaining] = useState(taskDuration);
  const [isActive, setIsActive] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isActive || timeRemaining <= 0) {
      if (timeRemaining <= 0) {
        setIsActive(false);
        onComplete(jobId, payPerTask);
      }
      return;
    }

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        const newTime = prev - 1;
        setProgress(((taskDuration - newTime) / taskDuration) * 100);
        return newTime;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, timeRemaining, taskDuration, jobId, payPerTask, onComplete]);

  if (!isActive) {
    return (
      <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/50">
        <div className="bg-green-900/80 border-2 border-green-500 rounded-lg p-8 text-center text-white max-w-sm">
          <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-400" />
          <h2 className="text-2xl font-bold mb-4">Job Complete!</h2>
          <p className="text-lg mb-2">{jobName}</p>
          <p className="text-3xl font-bold text-green-400 mb-4">+${payPerTask.toLocaleString()}</p>
          <button
            onClick={onCancel}
            className="bg-green-600 hover:bg-green-700 px-6 py-2 rounded-lg font-bold"
          >
            Continue Exploring
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/50">
      <div className="bg-gray-900/90 border-2 border-blue-500 rounded-lg p-8 text-white max-w-sm w-full mx-4">
        <h2 className="text-2xl font-bold mb-4">{jobName}</h2>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex justify-between mb-2">
            <span className="text-sm font-bold">Progress</span>
            <span className="text-sm">{Math.round(progress)}%</span>
          </div>
          <div className="w-full h-6 bg-gray-700 rounded-lg overflow-hidden border border-gray-600">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Time Remaining */}
        <div className="flex items-center gap-3 mb-6 bg-gray-800 p-3 rounded-lg">
          <Clock className="w-5 h-5 text-yellow-400" />
          <div>
            <span className="font-bold text-lg">{timeRemaining}s</span>
            <span className="text-gray-400 ml-2">remaining</span>
          </div>
        </div>

        {/* Reward Preview */}
        <div className="flex items-center gap-3 mb-6 bg-green-900/50 p-3 rounded-lg border border-green-600">
          <DollarSign className="w-5 h-5 text-green-400" />
          <div>
            <span className="text-gray-400">Reward</span>
            <p className="font-bold text-xl text-green-400">${payPerTask.toLocaleString()}</p>
          </div>
        </div>

        {/* Info */}
        <p className="text-gray-400 text-sm mb-6 text-center">Keep working... Don't leave the building!</p>

        {/* Cancel Button */}
        <button
          onClick={onCancel}
          className="w-full bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg font-bold transition-colors"
        >
          Abandon Job
        </button>
      </div>
    </div>
  );
}
