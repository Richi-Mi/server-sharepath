import fs from 'fs'
import path from 'path'
import { describe, expect, test } from "bun:test";
import { FileDataSource } from "../../src/data/FileDataSource";
import { CustomError } from '../../src/domain/CustomError';

describe('Testing for FileDataSource', () => {

    const fileDataSource = FileDataSource.getInstance()

    const uploadPATH = path.join( import.meta.dir, '../../uploads')
    const assetsPATH = path.join( import.meta.dir, '../assets')

    test('Should save file in uploads folder and return URL and delete file with URL', async () => {

        // Given.
        const image = fs.readFileSync(path.join(assetsPATH, 'test-image.jpeg'))
        const file = new File([image], 'test-image.jpg', { type: 'image/jpeg' })

        // Act.
        const url = await fileDataSource.saveFile(file)
        const [fileName] = url.split('/').reverse()        

        // Assert.
        expect(fs.existsSync(path.join(uploadPATH, fileName))).toBe(true)
        
        // Cleanup.
        await fileDataSource.deleteFile(url)

        expect(fs.existsSync(path.join(uploadPATH, fileName))).toBe(false)
    })
    test('Should getImage from uploads folder', async () => {
        // Given 
        const image = fs.readFileSync(path.join(import.meta.dir, '../assets/test-image.jpeg'))
        const file = new File([image], 'test-image.jpg', { type: 'image/jpeg' })

        // Act
        const url = await fileDataSource.saveFile(file)
        const [fileName] = url.split('/').reverse()        

        const { mimeType, buffer } = await fileDataSource.getFileFromSource(fileName)

        // Assert
        expect(mimeType).toBe('image/jpeg')
        expect(buffer).toBeInstanceOf(Buffer)

        // Cleanup
        await fileDataSource.deleteFile(url)
    })
    test('Should throw error if does not available file', async () => {
        // Given
        const fileName = "test.txt"
        const filePath = path.join(assetsPATH, fileName)

        const file = fs.readFileSync(filePath)
        const image = new File([file], fileName, { type: 'text/plain' })

        // Act
        try {
            await fileDataSource.saveFile(image)
        }
        catch (err) {            
            // Assert
            expect(err).toBeInstanceOf(CustomError)
        }
    })

})