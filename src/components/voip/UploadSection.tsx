import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, FileCheck, Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { mapError, logError } from '@/lib/errorHandler';

interface UploadSectionProps {
  onUploadComplete?: () => void;
}

export const UploadSection = ({ onUploadComplete }: UploadSectionProps) => {
  const [files, setFiles] = useState<File[]>([]);
  const [sessionName, setSessionName] = useState("");
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const handleUpload = async () => {
    if (files.length === 0 || !sessionName.trim()) {
      toast({
        title: "Missing Information",
        description: "Please provide a session name and select at least one PCAP file",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      // Create analysis session
      const session = await apiClient.createSession(sessionName);
      
      // Upload files
      await apiClient.uploadPcap(session.id, files);

      toast({
        title: "Upload Successful",
        description: `${files.length} file(s) uploaded and analysis started`,
      });

      // Reset form
      setFiles([]);
      setSessionName("");
      const fileInput = document.getElementById("pcap-files") as HTMLInputElement;
      if (fileInput) fileInput.value = "";

      // Trigger callback to refresh UI
      if (onUploadComplete) {
        onUploadComplete();
      }

    } catch (error: any) {
      logError('pcap-upload', error);
      
      const { message } = mapError(error);
      toast({
        title: "Upload Failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="p-6 glass-card">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-xl bg-primary/20 border border-primary/30">
          <Upload className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            Upload PCAP Files
          </h2>
          <p className="text-xs text-muted-foreground">
            Analyze network captures for VoIP quality metrics
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="session-name" className="text-xs text-foreground font-medium">
            Session Name
          </Label>
          <Input
            id="session-name"
            placeholder="Enter session name..."
            value={sessionName}
            onChange={(e) => setSessionName(e.target.value)}
            disabled={uploading}
            className="mt-1.5 bg-background/50 backdrop-blur-sm border-border"
          />
        </div>

        <div>
          <Label htmlFor="pcap-files" className="text-xs text-foreground font-medium">
            PCAP Files
          </Label>
          <Input
            id="pcap-files"
            type="file"
            accept=".pcap,.pcapng,.cap"
            multiple
            onChange={handleFileChange}
            disabled={uploading}
            className="mt-1.5 bg-background/50 backdrop-blur-sm border-border"
          />
          {files.length > 0 && (
            <div className="mt-3 space-y-2">
              {files.map((file, index) => (
                <div key={index} className="flex items-center gap-2 text-xs bg-primary/10 border border-primary/20 px-3 py-2 rounded-lg backdrop-blur-sm">
                  <FileCheck className="w-4 h-4 text-success" />
                  <span className="flex-1">{file.name}</span>
                  <span className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <Button 
          onClick={handleUpload} 
          disabled={uploading || files.length === 0 || !sessionName.trim()}
          className="w-full"
          size="lg"
        >
          {uploading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4 mr-2" />
              Upload & Analyze
            </>
          )}
        </Button>
      </div>
    </Card>
  );
};
