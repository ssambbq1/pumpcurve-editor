import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ManualProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const Manual: React.FC<ManualProps> = ({ open, onOpenChange }) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[800px] max-h-[80vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-center justify-between">
          <DialogTitle>Manual</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">단축키</h4>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <kbd className="px-2 py-1 bg-gray-100 rounded-md">Ctrl + Z</kbd>
                <span className="ml-2">실행 취소 (Undo)</span>
              </li>
              <li>
                <kbd className="px-2 py-1 bg-gray-100 rounded-md">Ctrl + Y</kbd>
                <span className="ml-2">다시 실행 (Redo)</span>
              </li>
              <li>
                <kbd className="px-2 py-1 bg-gray-100 rounded-md">Ctrl + E</kbd>
                <span className="ml-2">기록 모드 변경 (Change Recording Mode: Head → Efficiency → VFD)</span>
              </li>
              <li>
                <kbd className="px-2 py-1 bg-gray-100 rounded-md">Ctrl + X</kbd>
                <span className="ml-2">모든 포인트 삭제 (Delete All Points)</span>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-2">포인트 추가/삭제 (Point Management)</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li>좌클릭 (Left Click): 포인트 추가 (Add Point)</li>
              <li>우클릭 (Right Click): 가까운 포인트 삭제 (Delete Nearest Point)</li>
              <li>드래그 (Drag): 포인트 이동 (Move Point)</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-2">데이터 관리 (Data Management)</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li>Export JSON: 현재 데이터를 JSON 파일로 저장 (Save Current Data as JSON)</li>
              <li>Load Main Case: JSON 파일에서 메인 케이스 데이터 불러오기 (Load Main Case Data from JSON)</li>
              <li>Load Comparison: JSON 파일에서 비교 케이스 데이터 불러오기 (Load Comparison Case Data from JSON)</li>
              <li>Clear Comparison: 비교 케이스 데이터 삭제 (Clear Comparison Case Data)</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-2">배경 이미지 (Background Image)</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li>Load Image: 배경 이미지 불러오기 (Load Background Image)</li>
              <li>Clear Image: 배경 이미지 삭제 (Clear Background Image)</li>
              <li>Opacity: 배경 이미지 투명도 조절 (Adjust Background Image Opacity)</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default Manual; 